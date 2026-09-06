alter table public.stock_movements add column source_order_item_id uuid;

alter table public.stock_movements
  add constraint stock_movements_source_order_item_branch_fkey
  foreign key (source_order_item_id, branch_id)
  references public.order_items(id, branch_id);

create index idx_stock_movements_source_order_item_branch
  on public.stock_movements(source_order_item_id, branch_id)
  where source_order_item_id is not null;

update public.stock_movements sm
set source_order_item_id = oi.id
from public.order_items oi
where sm.reference_type = 'kitchen_ticket'
  and sm.branch_id = oi.branch_id
  and sm.source_order_item_id is null
  and sm.idempotency_key like '%:' || oi.id::text || ':%';

insert into public.permissions(key, module, description)
values
  ('pos.order.return', 'pos', 'Return sold order quantities'),
  ('pos.payment.refund', 'pos', 'Refund captured payments')
on conflict (key) do nothing;

create table public.order_returns (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  order_id uuid not null,
  total_amount numeric(14,2) not null check (total_amount > 0),
  reason text not null check (btrim(reason) <> ''),
  idempotency_key text not null check (btrim(idempotency_key) <> ''),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (id, branch_id),
  unique (branch_id, idempotency_key),
  foreign key (order_id, branch_id) references public.orders(id, branch_id)
);

create table public.order_return_items (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  return_id uuid not null,
  order_item_id uuid not null,
  quantity numeric(14,3) not null check (quantity > 0),
  refund_amount numeric(14,2) not null check (refund_amount >= 0),
  restock boolean not null default false,
  warehouse_id uuid null,
  created_at timestamptz not null default now(),
  foreign key (return_id, branch_id) references public.order_returns(id, branch_id),
  foreign key (order_item_id, branch_id) references public.order_items(id, branch_id),
  foreign key (warehouse_id, branch_id) references public.warehouses(id, branch_id)
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  return_id uuid not null,
  payment_id uuid not null,
  method text not null check (method in ('cash', 'card')),
  amount numeric(14,2) not null check (amount > 0),
  idempotency_key text not null check (btrim(idempotency_key) <> ''),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (branch_id, idempotency_key),
  foreign key (return_id, branch_id) references public.order_returns(id, branch_id),
  foreign key (payment_id, branch_id) references public.payments(id, branch_id)
);

create index idx_order_returns_order_branch on public.order_returns(order_id, branch_id);
create index idx_order_returns_created_by on public.order_returns(created_by);
create index idx_order_return_items_return_branch on public.order_return_items(return_id, branch_id);
create index idx_order_return_items_order_item_branch on public.order_return_items(order_item_id, branch_id);
create index idx_order_return_items_warehouse_branch on public.order_return_items(warehouse_id, branch_id) where warehouse_id is not null;
create index idx_refunds_return_branch on public.refunds(return_id, branch_id);
create index idx_refunds_payment_branch on public.refunds(payment_id, branch_id);
create index idx_refunds_created_by on public.refunds(created_by);

alter table public.order_returns enable row level security;
alter table public.order_return_items enable row level security;
alter table public.refunds enable row level security;

create policy order_returns_select on public.order_returns
for select to authenticated
using (app_private.current_user_may_access_branch(branch_id) and app_private.current_user_has_permission('pos.view', branch_id));

create policy order_return_items_select on public.order_return_items
for select to authenticated
using (app_private.current_user_may_access_branch(branch_id) and app_private.current_user_has_permission('pos.view', branch_id));

create policy refunds_select on public.refunds
for select to authenticated
using (app_private.current_user_may_access_branch(branch_id) and app_private.current_user_has_permission('pos.view', branch_id));

create or replace function app_private.send_order_to_kitchen_internal(p_order_id uuid, p_warehouse_id uuid, p_idempotency_key text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  v_user_id uuid := auth.uid();
  v_branch_id uuid;
  v_order_status text;
  v_ticket_id uuid;
  v_existing uuid;
  v_seq integer;
  v_key text := nullif(trim(p_idempotency_key), '');
  r record;
  c record;
  v_desired numeric;
  v_delta numeric;
  v_stock_delta numeric;
  v_available numeric;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if v_key is null then raise exception 'idempotency key required'; end if;
  select branch_id, status into v_branch_id, v_order_status from public.orders where id = p_order_id for update;
  if v_branch_id is null then raise exception 'order not found'; end if;
  if not app_private.current_user_has_permission('pos.send_kitchen', v_branch_id) then raise exception 'permission denied'; end if;
  if v_order_status not in ('created', 'sent_to_kitchen', 'preparing') then raise exception 'order cannot be sent to kitchen in current state'; end if;
  if not exists(select 1 from public.warehouses where id = p_warehouse_id and branch_id = v_branch_id and is_active) then raise exception 'warehouse unavailable'; end if;
  select id into v_existing from public.kitchen_tickets where branch_id = v_branch_id and idempotency_key = v_key;
  if v_existing is not null then return v_existing; end if;
  if not exists(select 1 from public.order_items oi where oi.order_id = p_order_id and ((case when oi.is_removed then 0 else oi.quantity end) - oi.sent_quantity) <> 0) then raise exception 'no kitchen changes to send'; end if;
  select coalesce(max(sequence_no), 0) + 1 into v_seq from public.kitchen_tickets where order_id = p_order_id;
  insert into public.kitchen_tickets(branch_id, order_id, sequence_no, warehouse_id, idempotency_key, created_by)
  values(v_branch_id, p_order_id, v_seq, p_warehouse_id, v_key, v_user_id) returning id into v_ticket_id;

  for r in
    select oi.id order_item_id, oi.product_id, oi.product_name, oi.quantity, oi.sent_quantity, oi.is_removed, p.inventory_item_id
    from public.order_items oi
    join public.products p on p.id = oi.product_id and p.branch_id = oi.branch_id
    where oi.order_id = p_order_id
  loop
    v_desired := case when r.is_removed then 0 else r.quantity end;
    v_delta := v_desired - r.sent_quantity;
    if v_delta = 0 then continue; end if;
    insert into public.kitchen_ticket_items(branch_id, kitchen_ticket_id, order_item_id, product_name, quantity_delta)
    values(v_branch_id, v_ticket_id, r.order_item_id, r.product_name, v_delta);

    if exists(select 1 from public.product_components pc where pc.branch_id = v_branch_id and pc.product_id = r.product_id) then
      for c in select inventory_item_id, quantity from public.product_components where branch_id = v_branch_id and product_id = r.product_id loop
        v_stock_delta := -(c.quantity * v_delta);
        if v_stock_delta < 0 then
          select coalesce(sum(quantity_delta), 0) into v_available from public.stock_movements where branch_id = v_branch_id and warehouse_id = p_warehouse_id and inventory_item_id = c.inventory_item_id;
          if v_available + v_stock_delta < 0 then raise exception 'insufficient inventory for %', r.product_name; end if;
        end if;
        insert into public.stock_movements(branch_id, warehouse_id, inventory_item_id, movement_type, quantity_delta, reference_type, reference_id, note, idempotency_key, created_by, source_order_item_id)
        values(v_branch_id, p_warehouse_id, c.inventory_item_id, case when v_stock_delta < 0 then 'sale_consumption' else 'return_in' end, v_stock_delta, 'kitchen_ticket', v_ticket_id, 'Kitchen delta: ' || r.product_name, v_key || ':' || r.order_item_id::text || ':' || c.inventory_item_id::text, v_user_id, r.order_item_id);
      end loop;
    elsif r.inventory_item_id is not null then
      v_stock_delta := -v_delta;
      if v_stock_delta < 0 then
        select coalesce(sum(quantity_delta), 0) into v_available from public.stock_movements where branch_id = v_branch_id and warehouse_id = p_warehouse_id and inventory_item_id = r.inventory_item_id;
        if v_available + v_stock_delta < 0 then raise exception 'insufficient inventory for %', r.product_name; end if;
      end if;
      insert into public.stock_movements(branch_id, warehouse_id, inventory_item_id, movement_type, quantity_delta, reference_type, reference_id, note, idempotency_key, created_by, source_order_item_id)
      values(v_branch_id, p_warehouse_id, r.inventory_item_id, case when v_stock_delta < 0 then 'sale_consumption' else 'return_in' end, v_stock_delta, 'kitchen_ticket', v_ticket_id, 'Kitchen delta: ' || r.product_name, v_key || ':' || r.order_item_id::text || ':' || r.inventory_item_id::text, v_user_id, r.order_item_id);
    else
      raise exception 'inventory mapping required for product %', r.product_name;
    end if;
    update public.order_items set sent_quantity = v_desired, updated_at = now() where id = r.order_item_id;
  end loop;
  update public.orders set status = case when status = 'created' then 'sent_to_kitchen' else status end, updated_at = now() where id = p_order_id;
  return v_ticket_id;
end $$;

create or replace function app_private.return_order_internal(p_order_id uuid, p_lines jsonb, p_refunds jsonb, p_reason text, p_idempotency_key text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid := auth.uid();
  v_branch uuid;
  v_status text;
  v_order_total numeric;
  v_subtotal numeric;
  v_return uuid;
  v_existing uuid;
  v_refund_shift uuid;
  v_key text := nullif(trim(p_idempotency_key), '');
  v_reason text := nullif(trim(p_reason), '');
  v_return_total numeric := 0;
  v_refund_total numeric := 0;
  l jsonb;
  r jsonb;
  v_item uuid;
  v_qty numeric;
  v_orig_qty numeric;
  v_unit numeric;
  v_prev_qty numeric;
  v_amount numeric;
  v_restock boolean;
  v_wh uuid;
  v_payment uuid;
  v_method text;
  v_ref_amt numeric;
  v_alloc numeric;
  v_prev_ref numeric;
  sm record;
  v_restore numeric;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if v_key is null then raise exception 'idempotency key required'; end if;
  if v_reason is null then raise exception 'return reason required'; end if;
  select branch_id, status, total, subtotal into v_branch, v_status, v_order_total, v_subtotal from public.orders where id = p_order_id for update;
  if v_branch is null then raise exception 'order not found'; end if;
  if not app_private.current_user_has_permission('pos.order.return', v_branch) or not app_private.current_user_has_permission('pos.payment.refund', v_branch) then raise exception 'permission denied'; end if;
  if v_status not in ('paid', 'closed', 'returned') then raise exception 'only paid or closed orders can be returned'; end if;
  select id into v_existing from public.order_returns where branch_id = v_branch and idempotency_key = v_key;
  if v_existing is not null then return v_existing; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'return lines required'; end if;
  if jsonb_typeof(p_refunds) <> 'array' or jsonb_array_length(p_refunds) = 0 then raise exception 'refund allocations required'; end if;

  insert into public.order_returns(branch_id, order_id, total_amount, reason, idempotency_key, created_by)
  values(v_branch, p_order_id, 0.01, v_reason, v_key, v_user) returning id into v_return;

  for l in select value from jsonb_array_elements(p_lines) loop
    v_item := (l ->> 'order_item_id')::uuid;
    v_qty := (l ->> 'quantity')::numeric;
    v_restock := coalesce((l ->> 'restock')::boolean, false);
    v_wh := nullif(l ->> 'warehouse_id', '')::uuid;
    if v_qty is null or v_qty <= 0 then raise exception 'return quantity must be positive'; end if;
    select quantity, unit_price into v_orig_qty, v_unit from public.order_items where id = v_item and order_id = p_order_id and branch_id = v_branch and not is_removed;
    if v_orig_qty is null then raise exception 'order item not found'; end if;
    select coalesce(sum(quantity), 0) into v_prev_qty from public.order_return_items where order_item_id = v_item and branch_id = v_branch;
    if v_prev_qty + v_qty > v_orig_qty then raise exception 'return quantity exceeds sold quantity'; end if;
    v_amount := round(v_unit * v_qty * case when v_subtotal > 0 then v_order_total / v_subtotal else 0 end, 2);
    v_return_total := v_return_total + v_amount;
    if v_restock and (v_wh is null or not exists(select 1 from public.warehouses where id = v_wh and branch_id = v_branch and is_active)) then raise exception 'active warehouse required for restock'; end if;
    insert into public.order_return_items(branch_id, return_id, order_item_id, quantity, refund_amount, restock, warehouse_id)
    values(v_branch, v_return, v_item, v_qty, v_amount, v_restock, v_wh);

    if v_restock then
      if not exists(select 1 from public.stock_movements where branch_id = v_branch and source_order_item_id = v_item and reference_type = 'kitchen_ticket') then raise exception 'historical stock lineage unavailable for restock'; end if;
      for sm in
        select inventory_item_id, sum(quantity_delta) qty
        from public.stock_movements
        where branch_id = v_branch and source_order_item_id = v_item and reference_type = 'kitchen_ticket'
        group by inventory_item_id
      loop
        if sm.qty < 0 then
          v_restore := round((-sm.qty) * (v_qty / v_orig_qty), 3);
          if v_restore > 0 then
            insert into public.stock_movements(branch_id, warehouse_id, inventory_item_id, movement_type, quantity_delta, reference_type, reference_id, idempotency_key, note, created_by, source_order_item_id)
            values(v_branch, v_wh, sm.inventory_item_id, 'return_in', v_restore, 'order_return', v_return, v_key || ':restock:' || v_item::text || ':' || sm.inventory_item_id::text, 'Return restock', v_user, v_item);
          end if;
        end if;
      end loop;
    end if;
  end loop;

  if v_return_total <= 0 then raise exception 'return amount must be positive'; end if;
  update public.order_returns set total_amount = v_return_total where id = v_return;

  for r in select value from jsonb_array_elements(p_refunds) loop
    v_payment := (r ->> 'payment_id')::uuid;
    v_ref_amt := (r ->> 'amount')::numeric;
    if v_ref_amt is null or v_ref_amt <= 0 then raise exception 'refund amount must be positive'; end if;
    select p.method, pa.amount into v_method, v_alloc
    from public.payments p
    join public.payment_allocations pa on pa.payment_id = p.id and pa.order_id = p_order_id and pa.branch_id = v_branch
    where p.id = v_payment and p.branch_id = v_branch and p.status in ('completed', 'refunded');
    if v_method is null then raise exception 'payment unavailable for refund'; end if;
    select coalesce(sum(amount), 0) into v_prev_ref from public.refunds where payment_id = v_payment and branch_id = v_branch;
    if v_prev_ref + v_ref_amt > v_alloc then raise exception 'refund exceeds original payment allocation'; end if;
    insert into public.refunds(branch_id, return_id, payment_id, method, amount, idempotency_key, created_by)
    values(v_branch, v_return, v_payment, v_method, v_ref_amt, v_key || ':refund:' || v_payment::text, v_user);
    v_refund_total := v_refund_total + v_ref_amt;

    if v_method = 'cash' then
      if v_refund_shift is null then
        select id into v_refund_shift from public.shifts where branch_id = v_branch and user_id = v_user and status = 'open' order by opened_at desc limit 1;
        if v_refund_shift is null then raise exception 'open shift required for cash refund'; end if;
      end if;
      insert into public.cash_drawer_movements(branch_id, shift_id, movement_type, amount, reason, idempotency_key, created_by)
      values(v_branch, v_refund_shift, 'cash_out', v_ref_amt, 'Refund for order return ' || v_return::text, gen_random_uuid(), v_user);
    end if;

    if v_prev_ref + v_ref_amt = v_alloc then update public.payments set status = 'refunded' where id = v_payment; end if;
  end loop;

  if round(v_refund_total, 2) <> round(v_return_total, 2) then raise exception 'refund allocations must equal return amount'; end if;
  if not exists(
    select 1 from public.order_items oi
    where oi.order_id = p_order_id and not oi.is_removed
      and coalesce((select sum(ri.quantity) from public.order_return_items ri where ri.order_item_id = oi.id), 0) < oi.quantity
  ) then
    update public.orders set status = 'returned', updated_at = now() where id = p_order_id;
  end if;
  return v_return;
end $$;

revoke all on function app_private.return_order_internal(uuid, jsonb, jsonb, text, text) from public, anon, authenticated;
grant execute on function app_private.return_order_internal(uuid, jsonb, jsonb, text, text) to authenticated;

create or replace function public.return_order(p_order_id uuid, p_lines jsonb, p_refunds jsonb, p_reason text, p_idempotency_key text)
returns uuid language sql security invoker set search_path=''
as $$ select app_private.return_order_internal(p_order_id, p_lines, p_refunds, p_reason, p_idempotency_key); $$;

revoke all on function public.return_order(uuid, jsonb, jsonb, text, text) from public, anon;
grant execute on function public.return_order(uuid, jsonb, jsonb, text, text) to authenticated;
