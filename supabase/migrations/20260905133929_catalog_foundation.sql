create table public.categories (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  code text not null,
  name_ar text not null,
  name_en text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, code),
  unique (id, branch_id),
  check (length(trim(code)) > 0),
  check (length(trim(name_ar)) > 0)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  category_id uuid,
  sku text,
  barcode text,
  name_ar text not null,
  name_en text,
  sale_price numeric(14,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, branch_id),
  foreign key (category_id, branch_id)
    references public.categories(id, branch_id)
    on delete restrict,
  check (length(trim(name_ar)) > 0),
  check (sale_price >= 0)
);

create unique index ux_products_branch_sku
  on public.products(branch_id, lower(sku))
  where sku is not null and length(trim(sku)) > 0;

create unique index ux_products_branch_barcode
  on public.products(branch_id, barcode)
  where barcode is not null and length(trim(barcode)) > 0;

create index idx_categories_branch_active_sort
  on public.categories(branch_id, is_active, sort_order, name_ar);

create index idx_products_branch_category_active
  on public.products(branch_id, category_id, is_active, name_ar);

alter table public.categories enable row level security;
alter table public.products enable row level security;

create policy categories_select_catalog_view on public.categories
for select to authenticated
using (
  app_private.current_user_has_permission('catalog.view', branch_id)
  or app_private.current_user_has_permission('catalog.manage', branch_id)
);

create policy categories_insert_catalog_manage on public.categories
for insert to authenticated
with check (app_private.current_user_has_permission('catalog.manage', branch_id));

create policy categories_update_catalog_manage on public.categories
for update to authenticated
using (app_private.current_user_has_permission('catalog.manage', branch_id))
with check (app_private.current_user_has_permission('catalog.manage', branch_id));

create policy categories_delete_catalog_manage on public.categories
for delete to authenticated
using (app_private.current_user_has_permission('catalog.manage', branch_id));

create policy products_select_catalog_view on public.products
for select to authenticated
using (
  app_private.current_user_has_permission('catalog.view', branch_id)
  or app_private.current_user_has_permission('catalog.manage', branch_id)
);

create policy products_insert_catalog_manage on public.products
for insert to authenticated
with check (app_private.current_user_has_permission('catalog.manage', branch_id));

create policy products_update_catalog_manage on public.products
for update to authenticated
using (app_private.current_user_has_permission('catalog.manage', branch_id))
with check (app_private.current_user_has_permission('catalog.manage', branch_id));

create policy products_delete_catalog_manage on public.products
for delete to authenticated
using (app_private.current_user_has_permission('catalog.manage', branch_id));

grant select, insert, update, delete on public.categories, public.products to authenticated;
