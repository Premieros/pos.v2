insert into public.permissions(key,module,description) values
('pos.tables.manage','pos','Manage dining tables and floor setup')
on conflict (key) do nothing;

create table public.dining_tables (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  code text not null,
  name text not null,
  floor_name text,
  capacity integer not null default 4 check (capacity > 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(branch_id, code),
  unique(id, branch_id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity,
  branch_id uuid not null references public.branches(id) on delete restrict,
  shift_id uuid not null,
  order_type text not null check (order_type in ('dine_in','take_away','drive_thru','delivery','quick')),
  status text not null default 'created' check (status in ('created','held','sent_to_kitchen','preparing','ready','partially_paid','paid','closed','cancelled','voided','returned')),
  dining_table_id uuid,
  guest_count integer not null default 1 check (guest_count >= 0),
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  discount_total numeric(14,2) not null default 0 check (discount_total >= 0),
  total numeric(14,2) not null default 0 check (total >= 0),
  notes text,
  idempotency_key text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id),
  cancel_reason text,
  unique(branch_id, order_number),
  unique(branch_id, idempotency_key),
  unique(id, branch_id),
  constraint orders_shift_branch_fkey foreign key (shift_id, branch_id) references public.shifts(id, branch_id) on delete restrict,
  constraint orders_table_branch_fkey foreign key (dining_table_id, branch_id) references public.dining_tables(id, branch_id) on delete restrict,
  constraint dine_in_requires_table check ((order_type = 'dine_in' and dining_table_id is not null) or (order_type <> 'dine_in' and dining_table_id is null))
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  order_id uuid not null,
  product_id uuid not null,
  product_name text not null,
  unit_price numeric(14,2) not null check (unit_price >= 0),
  quantity numeric(14,3) not null check (quantity > 0),
  sent_quantity numeric(14,3) not null default 0 check (sent_quantity >= 0),
  is_removed boolean not null default false,
  line_total numeric(14,2) not null default 0 check (line_total >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id, branch_id),
  constraint order_items_order_branch_fkey foreign key (order_id, branch_id) references public.orders(id, branch_id) on delete cascade,
  constraint order_items_product_branch_fkey foreign key (product_id, branch_id) references public.products(id, branch_id) on delete restrict
);

create index idx_dining_tables_branch_active on public.dining_tables(branch_id,is_active,sort_order);
create index idx_orders_branch_status_created on public.orders(branch_id,status,created_at desc);
create index idx_orders_shift on public.orders(shift_id,branch_id);
create index idx_orders_table_active on public.orders(dining_table_id,branch_id,status) where dining_table_id is not null;
create index idx_order_items_order_branch on public.order_items(order_id,branch_id);
create index idx_order_items_product_branch on public.order_items(product_id,branch_id);

alter table public.dining_tables enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

revoke all on public.dining_tables from anon, authenticated;
revoke all on public.orders from anon, authenticated;
revoke all on public.order_items from anon, authenticated;
grant select on public.dining_tables, public.orders, public.order_items to authenticated;

drop policy if exists dining_tables_select on public.dining_tables;
create policy dining_tables_select on public.dining_tables for select to authenticated
using ((select app_private.current_user_has_permission('pos.view',branch_id)));

drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders for select to authenticated
using ((select app_private.current_user_has_permission('pos.view',branch_id)));

drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items for select to authenticated
using ((select app_private.current_user_has_permission('pos.view',branch_id)));
