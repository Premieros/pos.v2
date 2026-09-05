insert into public.permissions(key, module, description)
values
  ('inventory.setup', 'inventory', 'Configure warehouses, inventory items, and product components'),
  ('inventory.adjust', 'inventory', 'Create explicit stock adjustments'),
  ('inventory.transfer', 'inventory', 'Transfer stock between warehouses'),
  ('inventory.receive', 'inventory', 'Receive stock into a warehouse'),
  ('inventory.count', 'inventory', 'Perform inventory counts'),
  ('inventory.waste', 'inventory', 'Record inventory waste')
on conflict (key) do nothing;

create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  code text not null,
  name_ar text not null,
  name_en text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, code),
  unique (id, branch_id),
  check (btrim(code) <> ''),
  check (btrim(name_ar) <> '')
);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  code text not null,
  name_ar text not null,
  name_en text,
  base_unit text not null,
  minimum_level numeric(18,4) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, code),
  unique (id, branch_id),
  check (btrim(code) <> ''),
  check (btrim(name_ar) <> ''),
  check (btrim(base_unit) <> ''),
  check (minimum_level >= 0)
);

create table public.product_components (
  branch_id uuid not null references public.branches(id) on delete cascade,
  product_id uuid not null,
  inventory_item_id uuid not null,
  quantity numeric(18,6) not null,
  created_at timestamptz not null default now(),
  primary key (product_id, inventory_item_id),
  foreign key (product_id, branch_id) references public.products(id, branch_id) on delete cascade,
  foreign key (inventory_item_id, branch_id) references public.inventory_items(id, branch_id) on delete restrict,
  check (quantity > 0)
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  warehouse_id uuid not null,
  inventory_item_id uuid not null,
  movement_type text not null,
  quantity_delta numeric(18,6) not null,
  reference_type text,
  reference_id uuid,
  idempotency_key text,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (warehouse_id, branch_id) references public.warehouses(id, branch_id) on delete restrict,
  foreign key (inventory_item_id, branch_id) references public.inventory_items(id, branch_id) on delete restrict,
  check (quantity_delta <> 0),
  check (movement_type in ('opening','receipt','sale_consumption','transfer_out','transfer_in','adjustment','waste','return_in','return_out','count_adjustment')),
  check (idempotency_key is null or btrim(idempotency_key) <> '')
);

create unique index ux_stock_movements_idempotency
  on public.stock_movements(branch_id, idempotency_key)
  where idempotency_key is not null;
create index idx_warehouses_branch_active on public.warehouses(branch_id, is_active);
create index idx_inventory_items_branch_active on public.inventory_items(branch_id, is_active);
create index idx_product_components_branch_product on public.product_components(branch_id, product_id);
create index idx_product_components_branch_item on public.product_components(branch_id, inventory_item_id);
create index idx_stock_movements_balance on public.stock_movements(branch_id, warehouse_id, inventory_item_id, created_at);
create index idx_stock_movements_item on public.stock_movements(branch_id, inventory_item_id, created_at);
create index idx_stock_movements_created_by on public.stock_movements(created_by);

create view public.inventory_balances
with (security_invoker = true)
as
select
  branch_id,
  warehouse_id,
  inventory_item_id,
  coalesce(sum(quantity_delta), 0)::numeric(18,6) as quantity
from public.stock_movements
group by branch_id, warehouse_id, inventory_item_id;

alter table public.warehouses enable row level security;
alter table public.inventory_items enable row level security;
alter table public.product_components enable row level security;
alter table public.stock_movements enable row level security;

create policy warehouses_select on public.warehouses
for select to authenticated
using (app_private.current_user_has_permission('inventory.view', branch_id));
create policy warehouses_insert on public.warehouses
for insert to authenticated
with check (app_private.current_user_has_permission('inventory.setup', branch_id));
create policy warehouses_update on public.warehouses
for update to authenticated
using (app_private.current_user_has_permission('inventory.setup', branch_id))
with check (app_private.current_user_has_permission('inventory.setup', branch_id));

create policy inventory_items_select on public.inventory_items
for select to authenticated
using (app_private.current_user_has_permission('inventory.view', branch_id));
create policy inventory_items_insert on public.inventory_items
for insert to authenticated
with check (app_private.current_user_has_permission('inventory.setup', branch_id));
create policy inventory_items_update on public.inventory_items
for update to authenticated
using (app_private.current_user_has_permission('inventory.setup', branch_id))
with check (app_private.current_user_has_permission('inventory.setup', branch_id));

create policy product_components_select on public.product_components
for select to authenticated
using (
  app_private.current_user_has_permission('inventory.view', branch_id)
  or app_private.current_user_has_permission('catalog.view', branch_id)
);
create policy product_components_insert on public.product_components
for insert to authenticated
with check (
  app_private.current_user_has_permission('inventory.setup', branch_id)
  and app_private.current_user_has_permission('catalog.manage', branch_id)
);
create policy product_components_update on public.product_components
for update to authenticated
using (
  app_private.current_user_has_permission('inventory.setup', branch_id)
  and app_private.current_user_has_permission('catalog.manage', branch_id)
)
with check (
  app_private.current_user_has_permission('inventory.setup', branch_id)
  and app_private.current_user_has_permission('catalog.manage', branch_id)
);
create policy product_components_delete on public.product_components
for delete to authenticated
using (
  app_private.current_user_has_permission('inventory.setup', branch_id)
  and app_private.current_user_has_permission('catalog.manage', branch_id)
);

create policy stock_movements_select on public.stock_movements
for select to authenticated
using (app_private.current_user_has_permission('inventory.view', branch_id));

revoke insert, update, delete on public.stock_movements from anon, authenticated;
grant select on public.inventory_balances to authenticated;
