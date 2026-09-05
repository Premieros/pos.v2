-- Batch 6.2 — Purchase documents + lines
-- Locked project: scpovyrqmsbiduanykod

insert into public.permissions(key,module,description) values
  ('procurement.purchases.view','procurement','View purchase documents in accessible branches'),
  ('procurement.purchases.create','procurement','Create purchase documents in accessible branches'),
  ('procurement.purchases.edit','procurement','Edit draft purchase documents in accessible branches'),
  ('procurement.purchases.receive','procurement','Receive purchase quantities into branch warehouses')
on conflict (key) do nothing;

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  purchase_number bigint not null,
  supplier_id uuid not null,
  status text not null default 'draft' check (status in ('draft','submitted','partially_received','received','cancelled')),
  subtotal numeric not null default 0 check (subtotal >= 0),
  total numeric not null default 0 check (total >= 0),
  notes text,
  idempotency_key text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, branch_id),
  unique (branch_id, purchase_number),
  unique (branch_id, idempotency_key),
  foreign key (supplier_id, branch_id) references public.suppliers(id, branch_id) on delete restrict
);

create table public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  purchase_order_id uuid not null,
  inventory_item_id uuid not null,
  ordered_quantity numeric not null check (ordered_quantity > 0),
  received_quantity numeric not null default 0,
  unit_cost numeric not null check (unit_cost >= 0),
  line_total numeric not null check (line_total >= 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (purchase_order_id, inventory_item_id),
  check (received_quantity >= 0 and received_quantity <= ordered_quantity),
  foreign key (purchase_order_id, branch_id) references public.purchase_orders(id, branch_id) on delete restrict,
  foreign key (inventory_item_id, branch_id) references public.inventory_items(id, branch_id) on delete restrict
);

create index idx_purchase_orders_branch_status_created on public.purchase_orders(branch_id,status,created_at desc);
create index idx_purchase_orders_supplier_branch on public.purchase_orders(supplier_id,branch_id);
create index idx_purchase_orders_created_by on public.purchase_orders(created_by);
create index idx_purchase_orders_updated_by on public.purchase_orders(updated_by);
create index idx_purchase_order_lines_branch on public.purchase_order_lines(branch_id);
create index idx_purchase_order_lines_purchase_branch on public.purchase_order_lines(purchase_order_id,branch_id);
create index idx_purchase_order_lines_item_branch on public.purchase_order_lines(inventory_item_id,branch_id);
create index idx_purchase_order_lines_created_by on public.purchase_order_lines(created_by);
create index idx_purchase_order_lines_updated_by on public.purchase_order_lines(updated_by);

alter table public.purchase_orders enable row level security;
alter table public.purchase_order_lines enable row level security;

create policy purchase_orders_select on public.purchase_orders
for select to authenticated
using (
  app_private.current_user_may_access_branch(branch_id)
  and (
    app_private.current_user_has_permission('procurement.purchases.view',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.create',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.edit',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.receive',branch_id)
  )
);

create policy purchase_order_lines_select on public.purchase_order_lines
for select to authenticated
using (
  app_private.current_user_may_access_branch(branch_id)
  and (
    app_private.current_user_has_permission('procurement.purchases.view',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.create',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.edit',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.receive',branch_id)
  )
);

revoke all on public.purchase_orders from authenticated;
revoke all on public.purchase_order_lines from authenticated;
grant select on public.purchase_orders to authenticated;
grant select on public.purchase_order_lines to authenticated;

create or replace function app_private.recalculate_purchase_order_internal(p_purchase_order_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare v_subtotal numeric(14,2);
begin
  select coalesce(round(sum(line_total),2),0) into v_subtotal
  from public.purchase_order_lines where purchase_order_id=p_purchase_order_id;
  update public.purchase_orders
  set subtotal=v_subtotal,total=v_subtotal,updated_at=now()
  where id=p_purchase_order_id;
end $$;

create or replace function app_private.create_purchase_order_internal(
  p_branch_id uuid,
  p_supplier_id uuid,
  p_notes text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_number bigint;
  v_key text := nullif(trim(p_idempotency_key),'');
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if v_key is null then raise exception 'idempotency key required'; end if;
  if not app_private.current_user_has_permission('procurement.purchases.create',p_branch_id) then raise exception 'permission denied'; end if;

  select id into v_id from public.purchase_orders
  where branch_id=p_branch_id and idempotency_key=v_key limit 1;
  if v_id is not null then return v_id; end if;

  if not exists(
    select 1 from public.suppliers s
    where s.id=p_supplier_id and s.branch_id=p_branch_id and s.is_active
  ) then raise exception 'supplier not found or inactive'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_branch_id::text,0));
  select coalesce(max(purchase_number),0)+1 into v_number
  from public.purchase_orders where branch_id=p_branch_id;

  insert into public.purchase_orders(
    branch_id,purchase_number,supplier_id,notes,idempotency_key,created_by,updated_by
  ) values (
    p_branch_id,v_number,p_supplier_id,nullif(trim(p_notes),''),v_key,v_user_id,v_user_id
  ) returning id into v_id;
  return v_id;
end $$;

create or replace function app_private.add_purchase_order_line_internal(
  p_purchase_order_id uuid,
  p_inventory_item_id uuid,
  p_quantity numeric,
  p_unit_cost numeric
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
  v_id uuid;
  v_total numeric(14,2);
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if p_quantity is null or p_quantity<=0 then raise exception 'quantity must be positive'; end if;
  if p_unit_cost is null or p_unit_cost<0 then raise exception 'unit cost cannot be negative'; end if;

  select branch_id,status into v_branch_id,v_status
  from public.purchase_orders where id=p_purchase_order_id for update;
  if v_branch_id is null then raise exception 'purchase order not found'; end if;
  if not app_private.current_user_has_permission('procurement.purchases.edit',v_branch_id) then raise exception 'permission denied'; end if;
  if v_status<>'draft' then raise exception 'only draft purchase orders can be edited'; end if;

  if not exists(
    select 1 from public.inventory_items i
    where i.id=p_inventory_item_id and i.branch_id=v_branch_id and i.is_active
  ) then raise exception 'inventory item not found or inactive'; end if;

  if exists(
    select 1 from public.purchase_order_lines
    where purchase_order_id=p_purchase_order_id and inventory_item_id=p_inventory_item_id
  ) then raise exception 'inventory item already exists on purchase order'; end if;

  v_total:=round(p_quantity*p_unit_cost,2);
  insert into public.purchase_order_lines(
    branch_id,purchase_order_id,inventory_item_id,ordered_quantity,unit_cost,line_total,created_by,updated_by
  ) values (
    v_branch_id,p_purchase_order_id,p_inventory_item_id,p_quantity,p_unit_cost,v_total,v_user_id,v_user_id
  ) returning id into v_id;

  perform app_private.recalculate_purchase_order_internal(p_purchase_order_id);
  return v_id;
end $$;

create or replace function app_private.update_purchase_order_line_internal(
  p_line_id uuid,
  p_quantity numeric,
  p_unit_cost numeric
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_branch_id uuid;
  v_purchase_id uuid;
  v_status text;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if p_quantity is null or p_quantity<=0 then raise exception 'quantity must be positive'; end if;
  if p_unit_cost is null or p_unit_cost<0 then raise exception 'unit cost cannot be negative'; end if;

  select l.branch_id,l.purchase_order_id,o.status
  into v_branch_id,v_purchase_id,v_status
  from public.purchase_order_lines l
  join public.purchase_orders o on o.id=l.purchase_order_id and o.branch_id=l.branch_id
  where l.id=p_line_id for update of l,o;

  if v_branch_id is null then raise exception 'purchase line not found'; end if;
  if not app_private.current_user_has_permission('procurement.purchases.edit',v_branch_id) then raise exception 'permission denied'; end if;
  if v_status<>'draft' then raise exception 'only draft purchase orders can be edited'; end if;

  update public.purchase_order_lines
  set ordered_quantity=p_quantity,
      unit_cost=p_unit_cost,
      line_total=round(p_quantity*p_unit_cost,2),
      updated_by=v_user_id,
      updated_at=now()
  where id=p_line_id;

  perform app_private.recalculate_purchase_order_internal(v_purchase_id);
end $$;

create or replace function app_private.remove_purchase_order_line_internal(p_line_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_branch_id uuid;
  v_purchase_id uuid;
  v_status text;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;

  select l.branch_id,l.purchase_order_id,o.status
  into v_branch_id,v_purchase_id,v_status
  from public.purchase_order_lines l
  join public.purchase_orders o on o.id=l.purchase_order_id and o.branch_id=l.branch_id
  where l.id=p_line_id for update of l,o;

  if v_branch_id is null then raise exception 'purchase line not found'; end if;
  if not app_private.current_user_has_permission('procurement.purchases.edit',v_branch_id) then raise exception 'permission denied'; end if;
  if v_status<>'draft' then raise exception 'only draft purchase orders can be edited'; end if;

  delete from public.purchase_order_lines where id=p_line_id;
  perform app_private.recalculate_purchase_order_internal(v_purchase_id);
end $$;

create or replace function public.create_purchase_order(
  p_branch_id uuid,
  p_supplier_id uuid,
  p_notes text,
  p_idempotency_key text
)
returns uuid language sql set search_path to ''
as $$ select app_private.create_purchase_order_internal(p_branch_id,p_supplier_id,p_notes,p_idempotency_key); $$;

create or replace function public.add_purchase_order_line(
  p_purchase_order_id uuid,
  p_inventory_item_id uuid,
  p_quantity numeric,
  p_unit_cost numeric
)
returns uuid language sql set search_path to ''
as $$ select app_private.add_purchase_order_line_internal(p_purchase_order_id,p_inventory_item_id,p_quantity,p_unit_cost); $$;

create or replace function public.update_purchase_order_line(
  p_line_id uuid,
  p_quantity numeric,
  p_unit_cost numeric
)
returns void language sql set search_path to ''
as $$ select app_private.update_purchase_order_line_internal(p_line_id,p_quantity,p_unit_cost); $$;

create or replace function public.remove_purchase_order_line(p_line_id uuid)
returns void language sql set search_path to ''
as $$ select app_private.remove_purchase_order_line_internal(p_line_id); $$;

revoke all on function app_private.recalculate_purchase_order_internal(uuid) from public, anon, authenticated;
revoke all on function app_private.create_purchase_order_internal(uuid,uuid,text,text) from public, anon, authenticated;
revoke all on function app_private.add_purchase_order_line_internal(uuid,uuid,numeric,numeric) from public, anon, authenticated;
revoke all on function app_private.update_purchase_order_line_internal(uuid,numeric,numeric) from public, anon, authenticated;
revoke all on function app_private.remove_purchase_order_line_internal(uuid) from public, anon, authenticated;

grant execute on function public.create_purchase_order(uuid,uuid,text,text) to authenticated;
grant execute on function public.add_purchase_order_line(uuid,uuid,numeric,numeric) to authenticated;
grant execute on function public.update_purchase_order_line(uuid,numeric,numeric) to authenticated;
grant execute on function public.remove_purchase_order_line(uuid) to authenticated;
