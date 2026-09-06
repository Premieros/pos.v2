create or replace function app_private.update_catalog_product_internal(
  p_product_id uuid,
  p_category_id uuid,
  p_sku text,
  p_barcode text,
  p_name_ar text,
  p_name_en text,
  p_sale_price numeric,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_branch_id uuid;
  v_name_ar text := nullif(trim(p_name_ar), '');
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select branch_id into v_branch_id
  from public.products
  where id = p_product_id
  for update;

  if v_branch_id is null then
    raise exception 'product not found';
  end if;
  if not app_private.current_user_has_permission('catalog.manage', v_branch_id) then
    raise exception 'permission denied';
  end if;
  if v_name_ar is null then
    raise exception 'product name is required';
  end if;
  if p_sale_price is null or p_sale_price < 0 then
    raise exception 'sale price must be non-negative';
  end if;
  if p_category_id is not null and not exists (
    select 1 from public.categories c
    where c.id = p_category_id and c.branch_id = v_branch_id
  ) then
    raise exception 'category must belong to product branch';
  end if;

  update public.products
  set category_id = p_category_id,
      sku = nullif(trim(p_sku), ''),
      barcode = nullif(trim(p_barcode), ''),
      name_ar = v_name_ar,
      name_en = nullif(trim(p_name_en), ''),
      sale_price = p_sale_price,
      is_active = coalesce(p_is_active, true),
      updated_at = now()
  where id = p_product_id;
end;
$$;

create or replace function public.update_catalog_product(
  p_product_id uuid,
  p_category_id uuid default null,
  p_sku text default null,
  p_barcode text default null,
  p_name_ar text default null,
  p_name_en text default null,
  p_sale_price numeric default null,
  p_is_active boolean default true
)
returns void
language sql
set search_path=''
as $$
  select app_private.update_catalog_product_internal(
    p_product_id,
    p_category_id,
    p_sku,
    p_barcode,
    p_name_ar,
    p_name_en,
    p_sale_price,
    p_is_active
  );
$$;

create or replace function app_private.update_catalog_category_internal(
  p_category_id uuid,
  p_name_ar text,
  p_name_en text,
  p_sort_order integer,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_branch_id uuid;
  v_name_ar text := nullif(trim(p_name_ar), '');
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select branch_id into v_branch_id
  from public.categories
  where id = p_category_id
  for update;

  if v_branch_id is null then
    raise exception 'category not found';
  end if;
  if not app_private.current_user_has_permission('catalog.manage', v_branch_id) then
    raise exception 'permission denied';
  end if;
  if v_name_ar is null then
    raise exception 'category name is required';
  end if;
  if p_sort_order is null then
    raise exception 'sort order is required';
  end if;

  update public.categories
  set name_ar = v_name_ar,
      name_en = nullif(trim(p_name_en), ''),
      sort_order = p_sort_order,
      is_active = coalesce(p_is_active, true),
      updated_at = now()
  where id = p_category_id;
end;
$$;

create or replace function public.update_catalog_category(
  p_category_id uuid,
  p_name_ar text,
  p_name_en text default null,
  p_sort_order integer default 0,
  p_is_active boolean default true
)
returns void
language sql
set search_path=''
as $$
  select app_private.update_catalog_category_internal(
    p_category_id,
    p_name_ar,
    p_name_en,
    p_sort_order,
    p_is_active
  );
$$;

revoke all on function app_private.update_catalog_product_internal(uuid,uuid,text,text,text,text,numeric,boolean) from public, anon;
grant execute on function app_private.update_catalog_product_internal(uuid,uuid,text,text,text,text,numeric,boolean) to authenticated;
revoke all on function public.update_catalog_product(uuid,uuid,text,text,text,text,numeric,boolean) from public, anon;
grant execute on function public.update_catalog_product(uuid,uuid,text,text,text,text,numeric,boolean) to authenticated;

revoke all on function app_private.update_catalog_category_internal(uuid,text,text,integer,boolean) from public, anon;
grant execute on function app_private.update_catalog_category_internal(uuid,text,text,integer,boolean) to authenticated;
revoke all on function public.update_catalog_category(uuid,text,text,integer,boolean) from public, anon;
grant execute on function public.update_catalog_category(uuid,text,text,integer,boolean) to authenticated;
