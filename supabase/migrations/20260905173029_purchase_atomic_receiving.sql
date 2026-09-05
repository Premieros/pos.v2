create table public.purchase_receipts (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  purchase_order_id uuid not null,
  warehouse_id uuid not null,
  idempotency_key text not null check (btrim(idempotency_key) <> ''),
  note text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (id, branch_id),
  unique (branch_id, idempotency_key),
  foreign key (purchase_order_id, branch_id) references public.purchase_orders(id, branch_id) on delete restrict,
  foreign key (warehouse_id, branch_id) references public.warehouses(id, branch_id) on delete restrict
);

create table public.purchase_receipt_lines (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  purchase_receipt_id uuid not null,
  purchase_order_line_id uuid not null,
  inventory_item_id uuid not null,
  quantity numeric not null check (quantity > 0),
  unit_cost numeric not null check (unit_cost >= 0),
  stock_movement_id uuid not null unique references public.stock_movements(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (purchase_receipt_id, branch_id) references public.purchase_receipts(id, branch_id) on delete restrict,
  foreign key (inventory_item_id, branch_id) references public.inventory_items(id, branch_id) on delete restrict
);

create index idx_purchase_receipts_order_branch on public.purchase_receipts(purchase_order_id,branch_id);
create index idx_purchase_receipts_warehouse_branch on public.purchase_receipts(warehouse_id,branch_id);
create index idx_purchase_receipts_created_by on public.purchase_receipts(created_by);
create index idx_purchase_receipt_lines_receipt_branch on public.purchase_receipt_lines(purchase_receipt_id,branch_id);
create index idx_purchase_receipt_lines_order_line on public.purchase_receipt_lines(purchase_order_line_id);
create index idx_purchase_receipt_lines_item_branch on public.purchase_receipt_lines(inventory_item_id,branch_id);

alter table public.purchase_receipts enable row level security;
alter table public.purchase_receipt_lines enable row level security;

create policy purchase_receipts_select on public.purchase_receipts
for select to authenticated
using (
  app_private.current_user_may_access_branch(branch_id)
  and (
    app_private.current_user_has_permission('procurement.purchases.view',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.receive',branch_id)
  )
);

create policy purchase_receipt_lines_select on public.purchase_receipt_lines
for select to authenticated
using (
  app_private.current_user_may_access_branch(branch_id)
  and (
    app_private.current_user_has_permission('procurement.purchases.view',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.receive',branch_id)
  )
);

revoke all on public.purchase_receipts from authenticated;
revoke all on public.purchase_receipt_lines from authenticated;
grant select on public.purchase_receipts to authenticated;
grant select on public.purchase_receipt_lines to authenticated;

drop policy if exists warehouses_select on public.warehouses;
create policy warehouses_select on public.warehouses
for select to authenticated
using (
  app_private.current_user_may_access_branch(branch_id)
  and (
    app_private.current_user_has_permission('inventory.view',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.receive',branch_id)
  )
);

create or replace function app_private.receive_purchase_order_internal(
  p_purchase_order_id uuid,
  p_warehouse_id uuid,
  p_lines jsonb,
  p_idempotency_key text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_branch_id uuid;
  v_status text;
  v_receipt_id uuid;
  v_existing_order_id uuid;
  v_existing_warehouse_id uuid;
  v_key text := nullif(btrim(p_idempotency_key),'');
  v_line jsonb;
  v_line_id uuid;
  v_item_id uuid;
  v_ordered numeric;
  v_received numeric;
  v_unit_cost numeric;
  v_qty numeric;
  v_movement_id uuid;
  v_line_count integer := 0;
  v_remaining_count integer;
  v_received_count integer;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if v_key is null then raise exception 'idempotency key required'; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines)=0 then
    raise exception 'at least one receipt line is required';
  end if;

  select branch_id,status into v_branch_id,v_status
  from public.purchase_orders
  where id=p_purchase_order_id
  for update;

  if v_branch_id is null then raise exception 'purchase order not found'; end if;
  if not app_private.current_user_has_permission('procurement.purchases.receive',v_branch_id) then
    raise exception 'permission denied';
  end if;
  if v_status in ('received','cancelled') then
    raise exception 'purchase order cannot be received in current status';
  end if;

  if not exists(
    select 1 from public.warehouses w
    where w.id=p_warehouse_id and w.branch_id=v_branch_id and w.is_active
  ) then raise exception 'active warehouse not found in purchase branch'; end if;

  select id,purchase_order_id,warehouse_id
  into v_receipt_id,v_existing_order_id,v_existing_warehouse_id
  from public.purchase_receipts
  where branch_id=v_branch_id and idempotency_key=v_key
  limit 1;

  if v_receipt_id is not null then
    if v_existing_order_id<>p_purchase_order_id or v_existing_warehouse_id<>p_warehouse_id then
      raise exception 'idempotency key conflict';
    end if;
    return v_receipt_id;
  end if;

  insert into public.purchase_receipts(
    branch_id,purchase_order_id,warehouse_id,idempotency_key,note,created_by
  ) values (
    v_branch_id,p_purchase_order_id,p_warehouse_id,v_key,nullif(btrim(p_note),''),v_user_id
  ) returning id into v_receipt_id;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    v_line_count := v_line_count + 1;
    begin
      v_line_id := (v_line->>'line_id')::uuid;
      v_qty := (v_line->>'quantity')::numeric;
    exception when others then
      raise exception 'invalid purchase receipt line payload';
    end;

    if v_line_id is null or v_qty is null or v_qty<=0 then
      raise exception 'receipt quantity must be positive';
    end if;

    select inventory_item_id,ordered_quantity,received_quantity,unit_cost
    into v_item_id,v_ordered,v_received,v_unit_cost
    from public.purchase_order_lines
    where id=v_line_id and purchase_order_id=p_purchase_order_id and branch_id=v_branch_id
    for update;

    if v_item_id is null then raise exception 'purchase order line not found'; end if;
    if v_received + v_qty > v_ordered then
      raise exception 'receipt quantity exceeds remaining ordered quantity';
    end if;

    if exists(
      select 1 from public.purchase_receipt_lines prl
      where prl.purchase_receipt_id=v_receipt_id and prl.purchase_order_line_id=v_line_id
    ) then raise exception 'duplicate purchase order line in receipt'; end if;

    insert into public.stock_movements(
      branch_id,warehouse_id,inventory_item_id,movement_type,quantity_delta,
      reference_type,reference_id,idempotency_key,note,created_by
    ) values (
      v_branch_id,p_warehouse_id,v_item_id,'receipt',v_qty,
      'purchase_receipt',v_receipt_id,
      'purchase-receipt:'||v_receipt_id::text||':'||v_line_id::text,
      'Purchase receipt '||v_receipt_id::text,
      v_user_id
    ) returning id into v_movement_id;

    insert into public.purchase_receipt_lines(
      branch_id,purchase_receipt_id,purchase_order_line_id,inventory_item_id,
      quantity,unit_cost,stock_movement_id
    ) values (
      v_branch_id,v_receipt_id,v_line_id,v_item_id,v_qty,v_unit_cost,v_movement_id
    );

    update public.purchase_order_lines
    set received_quantity=received_quantity+v_qty,
        updated_by=v_user_id,
        updated_at=now()
    where id=v_line_id;
  end loop;

  if v_line_count=0 then raise exception 'at least one receipt line is required'; end if;

  select
    count(*) filter (where received_quantity < ordered_quantity),
    count(*) filter (where received_quantity > 0)
  into v_remaining_count,v_received_count
  from public.purchase_order_lines
  where purchase_order_id=p_purchase_order_id and branch_id=v_branch_id;

  update public.purchase_orders
  set status=case
      when v_remaining_count=0 then 'received'
      when v_received_count>0 then 'partially_received'
      else status
    end,
    updated_by=v_user_id,
    updated_at=now()
  where id=p_purchase_order_id;

  return v_receipt_id;
end $$;

create or replace function public.receive_purchase_order(
  p_purchase_order_id uuid,
  p_warehouse_id uuid,
  p_lines jsonb,
  p_idempotency_key text,
  p_note text default null
)
returns uuid
language sql
set search_path to ''
as $$
  select app_private.receive_purchase_order_internal(
    p_purchase_order_id,p_warehouse_id,p_lines,p_idempotency_key,p_note
  );
$$;

revoke all on function app_private.receive_purchase_order_internal(uuid,uuid,jsonb,text,text) from public,anon,authenticated;
revoke all on function public.receive_purchase_order(uuid,uuid,jsonb,text,text) from public,anon;
grant execute on function public.receive_purchase_order(uuid,uuid,jsonb,text,text) to authenticated;
