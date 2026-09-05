insert into public.permissions(key,module,description) values
  ('procurement.purchases.submit','procurement','Submit draft purchase orders for receiving'),
  ('procurement.purchases.cancel','procurement','Cancel eligible purchase orders')
on conflict (key) do nothing;

create table public.purchase_order_status_events (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  purchase_order_id uuid not null,
  from_status text not null,
  to_status text not null,
  reason text,
  idempotency_key text not null check (btrim(idempotency_key) <> ''),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (branch_id,idempotency_key),
  foreign key (purchase_order_id,branch_id) references public.purchase_orders(id,branch_id) on delete restrict
);

create index idx_purchase_order_status_events_order_branch on public.purchase_order_status_events(purchase_order_id,branch_id);
create index idx_purchase_order_status_events_created_by on public.purchase_order_status_events(created_by);

alter table public.purchase_order_status_events enable row level security;
create policy purchase_order_status_events_select on public.purchase_order_status_events
for select to authenticated
using (
  app_private.current_user_may_access_branch(branch_id)
  and (
    app_private.current_user_has_permission('procurement.purchases.view',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.submit',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.cancel',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.receive',branch_id)
  )
);
revoke all on public.purchase_order_status_events from authenticated;
grant select on public.purchase_order_status_events to authenticated;

drop policy if exists purchase_orders_select on public.purchase_orders;
create policy purchase_orders_select on public.purchase_orders
for select to authenticated
using (
  app_private.current_user_may_access_branch(branch_id)
  and (
    app_private.current_user_has_permission('procurement.purchases.view',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.create',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.edit',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.submit',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.cancel',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.receive',branch_id)
  )
);

drop policy if exists purchase_order_lines_select on public.purchase_order_lines;
create policy purchase_order_lines_select on public.purchase_order_lines
for select to authenticated
using (
  app_private.current_user_may_access_branch(branch_id)
  and (
    app_private.current_user_has_permission('procurement.purchases.view',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.create',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.edit',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.submit',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.cancel',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.receive',branch_id)
  )
);

drop policy if exists suppliers_select on public.suppliers;
create policy suppliers_select on public.suppliers
for select to authenticated
using (
  app_private.current_user_may_access_branch(branch_id)
  and (
    app_private.current_user_has_permission('procurement.view',branch_id)
    or app_private.current_user_has_permission('procurement.suppliers.manage',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.view',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.create',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.edit',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.submit',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.cancel',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.receive',branch_id)
  )
);

drop policy if exists inventory_items_select on public.inventory_items;
create policy inventory_items_select on public.inventory_items
for select to authenticated
using (
  app_private.current_user_may_access_branch(branch_id)
  and (
    app_private.current_user_has_permission('inventory.view',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.view',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.create',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.edit',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.submit',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.cancel',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.receive',branch_id)
  )
);

create or replace function app_private.submit_purchase_order_internal(p_purchase_order_id uuid,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path to ''
as $$
declare v_user_id uuid:=auth.uid(); v_branch_id uuid; v_status text; v_event_id uuid; v_key text:=nullif(btrim(p_idempotency_key),'');
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if v_key is null then raise exception 'idempotency key required'; end if;
  select id into v_event_id from public.purchase_order_status_events where idempotency_key=v_key and purchase_order_id=p_purchase_order_id limit 1;
  if v_event_id is not null then return v_event_id; end if;
  select branch_id,status into v_branch_id,v_status from public.purchase_orders where id=p_purchase_order_id for update;
  if v_branch_id is null then raise exception 'purchase order not found'; end if;
  if not app_private.current_user_has_permission('procurement.purchases.submit',v_branch_id) then raise exception 'permission denied'; end if;
  if v_status<>'draft' then raise exception 'only draft purchase orders can be submitted'; end if;
  if not exists(select 1 from public.purchase_order_lines where purchase_order_id=p_purchase_order_id and branch_id=v_branch_id) then raise exception 'purchase order must contain at least one line'; end if;
  update public.purchase_orders set status='submitted',updated_by=v_user_id,updated_at=now() where id=p_purchase_order_id;
  insert into public.purchase_order_status_events(branch_id,purchase_order_id,from_status,to_status,idempotency_key,created_by)
  values(v_branch_id,p_purchase_order_id,'draft','submitted',v_key,v_user_id) returning id into v_event_id;
  return v_event_id;
end $$;

create or replace function app_private.cancel_purchase_order_internal(p_purchase_order_id uuid,p_reason text,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path to ''
as $$
declare v_user_id uuid:=auth.uid(); v_branch_id uuid; v_status text; v_event_id uuid; v_key text:=nullif(btrim(p_idempotency_key),''); v_reason text:=nullif(btrim(p_reason),'');
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if v_key is null then raise exception 'idempotency key required'; end if;
  if v_reason is null then raise exception 'cancel reason required'; end if;
  select id into v_event_id from public.purchase_order_status_events where idempotency_key=v_key and purchase_order_id=p_purchase_order_id limit 1;
  if v_event_id is not null then return v_event_id; end if;
  select branch_id,status into v_branch_id,v_status from public.purchase_orders where id=p_purchase_order_id for update;
  if v_branch_id is null then raise exception 'purchase order not found'; end if;
  if not app_private.current_user_has_permission('procurement.purchases.cancel',v_branch_id) then raise exception 'permission denied'; end if;
  if v_status not in ('draft','submitted') then raise exception 'purchase order cannot be cancelled in current status'; end if;
  if exists(select 1 from public.purchase_receipts where purchase_order_id=p_purchase_order_id and branch_id=v_branch_id) then raise exception 'purchase order with receipt history cannot be cancelled'; end if;
  update public.purchase_orders set status='cancelled',updated_by=v_user_id,updated_at=now() where id=p_purchase_order_id;
  insert into public.purchase_order_status_events(branch_id,purchase_order_id,from_status,to_status,reason,idempotency_key,created_by)
  values(v_branch_id,p_purchase_order_id,v_status,'cancelled',v_reason,v_key,v_user_id) returning id into v_event_id;
  return v_event_id;
end $$;

create or replace function public.submit_purchase_order(p_purchase_order_id uuid,p_idempotency_key text)
returns uuid language sql set search_path to '' as $$ select app_private.submit_purchase_order_internal(p_purchase_order_id,p_idempotency_key); $$;
create or replace function public.cancel_purchase_order(p_purchase_order_id uuid,p_reason text,p_idempotency_key text)
returns uuid language sql set search_path to '' as $$ select app_private.cancel_purchase_order_internal(p_purchase_order_id,p_reason,p_idempotency_key); $$;
revoke all on function app_private.submit_purchase_order_internal(uuid,text) from public,anon,authenticated;
revoke all on function app_private.cancel_purchase_order_internal(uuid,text,text) from public,anon,authenticated;
revoke all on function public.submit_purchase_order(uuid,text) from public,anon;
revoke all on function public.cancel_purchase_order(uuid,text,text) from public,anon;
grant execute on function public.submit_purchase_order(uuid,text) to authenticated;
grant execute on function public.cancel_purchase_order(uuid,text,text) to authenticated;

create or replace function app_private.receive_purchase_order_internal(p_purchase_order_id uuid,p_warehouse_id uuid,p_lines jsonb,p_idempotency_key text,p_note text default null)
returns uuid language plpgsql security definer set search_path to ''
as $$
declare
  v_user_id uuid:=auth.uid(); v_branch_id uuid; v_status text; v_new_status text; v_receipt_id uuid; v_existing_order_id uuid; v_existing_warehouse_id uuid; v_key text:=nullif(btrim(p_idempotency_key),''); v_line jsonb; v_line_id uuid; v_item_id uuid; v_ordered numeric; v_received numeric; v_unit_cost numeric; v_qty numeric; v_movement_id uuid; v_remaining_count integer; v_received_count integer;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if v_key is null then raise exception 'idempotency key required'; end if;
  if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 then raise exception 'at least one receipt line is required'; end if;
  select branch_id,status into v_branch_id,v_status from public.purchase_orders where id=p_purchase_order_id for update;
  if v_branch_id is null then raise exception 'purchase order not found'; end if;
  if not app_private.current_user_has_permission('procurement.purchases.receive',v_branch_id) then raise exception 'permission denied'; end if;
  if v_status not in ('submitted','partially_received') then raise exception 'purchase order must be submitted before receiving'; end if;
  if not exists(select 1 from public.warehouses where id=p_warehouse_id and branch_id=v_branch_id and is_active) then raise exception 'active warehouse not found in purchase branch'; end if;
  select id,purchase_order_id,warehouse_id into v_receipt_id,v_existing_order_id,v_existing_warehouse_id from public.purchase_receipts where branch_id=v_branch_id and idempotency_key=v_key limit 1;
  if v_receipt_id is not null then if v_existing_order_id<>p_purchase_order_id or v_existing_warehouse_id<>p_warehouse_id then raise exception 'idempotency key conflict'; end if; return v_receipt_id; end if;
  insert into public.purchase_receipts(branch_id,purchase_order_id,warehouse_id,idempotency_key,note,created_by) values(v_branch_id,p_purchase_order_id,p_warehouse_id,v_key,nullif(btrim(p_note),''),v_user_id) returning id into v_receipt_id;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    begin v_line_id:=(v_line->>'line_id')::uuid; v_qty:=(v_line->>'quantity')::numeric; exception when others then raise exception 'invalid purchase receipt line payload'; end;
    if v_line_id is null or v_qty is null or v_qty<=0 then raise exception 'receipt quantity must be positive'; end if;
    select inventory_item_id,ordered_quantity,received_quantity,unit_cost into v_item_id,v_ordered,v_received,v_unit_cost from public.purchase_order_lines where id=v_line_id and purchase_order_id=p_purchase_order_id and branch_id=v_branch_id for update;
    if v_item_id is null then raise exception 'purchase order line not found'; end if;
    if v_received+v_qty>v_ordered then raise exception 'receipt quantity exceeds remaining ordered quantity'; end if;
    if exists(select 1 from public.purchase_receipt_lines where purchase_receipt_id=v_receipt_id and purchase_order_line_id=v_line_id) then raise exception 'duplicate purchase order line in receipt'; end if;
    insert into public.stock_movements(branch_id,warehouse_id,inventory_item_id,movement_type,quantity_delta,reference_type,reference_id,idempotency_key,note,created_by)
    values(v_branch_id,p_warehouse_id,v_item_id,'receipt',v_qty,'purchase_receipt',v_receipt_id,'purchase-receipt:'||v_receipt_id::text||':'||v_line_id::text,'Purchase receipt '||v_receipt_id::text,v_user_id) returning id into v_movement_id;
    insert into public.purchase_receipt_lines(branch_id,purchase_receipt_id,purchase_order_line_id,inventory_item_id,quantity,unit_cost,stock_movement_id)
    values(v_branch_id,v_receipt_id,v_line_id,v_item_id,v_qty,v_unit_cost,v_movement_id);
    update public.purchase_order_lines set received_quantity=received_quantity+v_qty,updated_by=v_user_id,updated_at=now() where id=v_line_id;
  end loop;
  select count(*) filter(where received_quantity<ordered_quantity),count(*) filter(where received_quantity>0) into v_remaining_count,v_received_count from public.purchase_order_lines where purchase_order_id=p_purchase_order_id and branch_id=v_branch_id;
  v_new_status:=case when v_remaining_count=0 then 'received' when v_received_count>0 then 'partially_received' else v_status end;
  update public.purchase_orders set status=v_new_status,updated_by=v_user_id,updated_at=now() where id=p_purchase_order_id;
  if v_new_status<>v_status then insert into public.purchase_order_status_events(branch_id,purchase_order_id,from_status,to_status,reason,idempotency_key,created_by) values(v_branch_id,p_purchase_order_id,v_status,v_new_status,'Derived from accepted purchase receipt','receipt-status:'||v_receipt_id::text,v_user_id); end if;
  return v_receipt_id;
end $$;

create or replace view public.inventory_item_purchase_cost_history with (security_invoker=true) as
select pr.branch_id,prl.inventory_item_id,prl.unit_cost,prl.quantity,pr.id purchase_receipt_id,prl.id purchase_receipt_line_id,pr.purchase_order_id,po.supplier_id,pr.warehouse_id,pr.created_at received_at
from public.purchase_receipt_lines prl
join public.purchase_receipts pr on pr.id=prl.purchase_receipt_id and pr.branch_id=prl.branch_id
join public.purchase_orders po on po.id=pr.purchase_order_id and po.branch_id=pr.branch_id;
grant select on public.inventory_item_purchase_cost_history to authenticated;
