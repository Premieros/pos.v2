create or replace function app_private.create_modifier_group_internal(
  p_branch_id uuid, p_code text, p_name_ar text, p_name_en text default null,
  p_min_select integer default 0, p_max_select integer default 1
) returns uuid language plpgsql security definer set search_path=''
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not app_private.current_user_has_permission('catalog.manage',p_branch_id) then raise exception 'permission denied'; end if;
  if nullif(trim(p_code),'') is null or nullif(trim(p_name_ar),'') is null then raise exception 'code and Arabic name required'; end if;
  if p_min_select < 0 or p_max_select < p_min_select then raise exception 'invalid modifier selection bounds'; end if;
  insert into public.modifier_groups(branch_id,code,name_ar,name_en,min_select,max_select,created_by)
  values(p_branch_id,upper(trim(p_code)),trim(p_name_ar),nullif(trim(p_name_en),''),p_min_select,p_max_select,auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function app_private.update_modifier_group_internal(
  p_group_id uuid, p_name_ar text, p_name_en text default null,
  p_min_select integer default 0, p_max_select integer default 1, p_is_active boolean default true
) returns void language plpgsql security definer set search_path=''
as $$
declare v_branch uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select branch_id into v_branch from public.modifier_groups where id=p_group_id for update;
  if v_branch is null then raise exception 'modifier group not found'; end if;
  if not app_private.current_user_has_permission('catalog.manage',v_branch) then raise exception 'permission denied'; end if;
  if nullif(trim(p_name_ar),'') is null then raise exception 'Arabic name required'; end if;
  if p_min_select < 0 or p_max_select < p_min_select then raise exception 'invalid modifier selection bounds'; end if;
  update public.modifier_groups set name_ar=trim(p_name_ar),name_en=nullif(trim(p_name_en),''),min_select=p_min_select,max_select=p_max_select,is_active=p_is_active,updated_at=now() where id=p_group_id;
end $$;

create or replace function app_private.create_modifier_option_internal(
  p_group_id uuid, p_code text, p_name_ar text, p_name_en text default null,
  p_price_delta numeric default 0, p_inventory_item_id uuid default null,
  p_inventory_quantity numeric default 0
) returns uuid language plpgsql security definer set search_path=''
as $$
declare v_branch uuid; v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select branch_id into v_branch from public.modifier_groups where id=p_group_id and is_active;
  if v_branch is null then raise exception 'modifier group unavailable'; end if;
  if not app_private.current_user_has_permission('catalog.manage',v_branch) then raise exception 'permission denied'; end if;
  if nullif(trim(p_code),'') is null or nullif(trim(p_name_ar),'') is null then raise exception 'code and Arabic name required'; end if;
  if p_inventory_quantity < 0 then raise exception 'inventory quantity cannot be negative'; end if;
  if p_inventory_item_id is not null and not exists(select 1 from public.inventory_items where id=p_inventory_item_id and branch_id=v_branch and is_active) then raise exception 'inventory item unavailable'; end if;
  insert into public.modifier_options(branch_id,group_id,code,name_ar,name_en,price_delta,inventory_item_id,inventory_quantity,created_by)
  values(v_branch,p_group_id,upper(trim(p_code)),trim(p_name_ar),nullif(trim(p_name_en),''),coalesce(p_price_delta,0),p_inventory_item_id,coalesce(p_inventory_quantity,0),auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function app_private.update_modifier_option_internal(
  p_option_id uuid, p_name_ar text, p_name_en text default null,
  p_price_delta numeric default 0, p_inventory_item_id uuid default null,
  p_inventory_quantity numeric default 0, p_is_active boolean default true
) returns void language plpgsql security definer set search_path=''
as $$
declare v_branch uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select branch_id into v_branch from public.modifier_options where id=p_option_id for update;
  if v_branch is null then raise exception 'modifier option not found'; end if;
  if not app_private.current_user_has_permission('catalog.manage',v_branch) then raise exception 'permission denied'; end if;
  if nullif(trim(p_name_ar),'') is null then raise exception 'Arabic name required'; end if;
  if p_inventory_quantity < 0 then raise exception 'inventory quantity cannot be negative'; end if;
  if p_inventory_item_id is not null and not exists(select 1 from public.inventory_items where id=p_inventory_item_id and branch_id=v_branch and is_active) then raise exception 'inventory item unavailable'; end if;
  update public.modifier_options set name_ar=trim(p_name_ar),name_en=nullif(trim(p_name_en),''),price_delta=coalesce(p_price_delta,0),inventory_item_id=p_inventory_item_id,inventory_quantity=coalesce(p_inventory_quantity,0),is_active=p_is_active,updated_at=now() where id=p_option_id;
end $$;

create or replace function app_private.set_product_modifier_groups_internal(p_product_id uuid,p_group_ids uuid[])
returns void language plpgsql security definer set search_path=''
as $$
declare v_branch uuid; v_group uuid; v_sort integer:=0;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select branch_id into v_branch from public.products where id=p_product_id and is_active;
  if v_branch is null then raise exception 'product unavailable'; end if;
  if not app_private.current_user_has_permission('catalog.manage',v_branch) then raise exception 'permission denied'; end if;
  if exists(select 1 from unnest(coalesce(p_group_ids,'{}'::uuid[])) g left join public.modifier_groups mg on mg.id=g and mg.branch_id=v_branch and mg.is_active where mg.id is null) then raise exception 'modifier group unavailable for branch'; end if;
  if (select count(*) from unnest(coalesce(p_group_ids,'{}'::uuid[]))) <> (select count(distinct g) from unnest(coalesce(p_group_ids,'{}'::uuid[])) g) then raise exception 'duplicate modifier group'; end if;
  delete from public.product_modifier_groups where product_id=p_product_id and branch_id=v_branch;
  foreach v_group in array coalesce(p_group_ids,'{}'::uuid[]) loop
    insert into public.product_modifier_groups(branch_id,product_id,group_id,sort_order,created_by) values(v_branch,p_product_id,v_group,v_sort,auth.uid());
    v_sort:=v_sort+1;
  end loop;
end $$;

create or replace function public.create_modifier_group(p_branch_id uuid,p_code text,p_name_ar text,p_name_en text default null,p_min_select integer default 0,p_max_select integer default 1)
returns uuid language sql set search_path='' as $$ select app_private.create_modifier_group_internal(p_branch_id,p_code,p_name_ar,p_name_en,p_min_select,p_max_select); $$;
create or replace function public.update_modifier_group(p_group_id uuid,p_name_ar text,p_name_en text default null,p_min_select integer default 0,p_max_select integer default 1,p_is_active boolean default true)
returns void language sql set search_path='' as $$ select app_private.update_modifier_group_internal(p_group_id,p_name_ar,p_name_en,p_min_select,p_max_select,p_is_active); $$;
create or replace function public.create_modifier_option(p_group_id uuid,p_code text,p_name_ar text,p_name_en text default null,p_price_delta numeric default 0,p_inventory_item_id uuid default null,p_inventory_quantity numeric default 0)
returns uuid language sql set search_path='' as $$ select app_private.create_modifier_option_internal(p_group_id,p_code,p_name_ar,p_name_en,p_price_delta,p_inventory_item_id,p_inventory_quantity); $$;
create or replace function public.update_modifier_option(p_option_id uuid,p_name_ar text,p_name_en text default null,p_price_delta numeric default 0,p_inventory_item_id uuid default null,p_inventory_quantity numeric default 0,p_is_active boolean default true)
returns void language sql set search_path='' as $$ select app_private.update_modifier_option_internal(p_option_id,p_name_ar,p_name_en,p_price_delta,p_inventory_item_id,p_inventory_quantity,p_is_active); $$;
create or replace function public.set_product_modifier_groups(p_product_id uuid,p_group_ids uuid[])
returns void language sql set search_path='' as $$ select app_private.set_product_modifier_groups_internal(p_product_id,p_group_ids); $$;

revoke all on function app_private.create_modifier_group_internal(uuid,text,text,text,integer,integer) from public,anon;
revoke all on function app_private.update_modifier_group_internal(uuid,text,text,integer,integer,boolean) from public,anon;
revoke all on function app_private.create_modifier_option_internal(uuid,text,text,text,numeric,uuid,numeric) from public,anon;
revoke all on function app_private.update_modifier_option_internal(uuid,text,text,numeric,uuid,numeric,boolean) from public,anon;
revoke all on function app_private.set_product_modifier_groups_internal(uuid,uuid[]) from public,anon;
grant execute on function app_private.create_modifier_group_internal(uuid,text,text,text,integer,integer),app_private.update_modifier_group_internal(uuid,text,text,integer,integer,boolean),app_private.create_modifier_option_internal(uuid,text,text,text,numeric,uuid,numeric),app_private.update_modifier_option_internal(uuid,text,text,numeric,uuid,numeric,boolean),app_private.set_product_modifier_groups_internal(uuid,uuid[]) to authenticated;

revoke all on function public.create_modifier_group(uuid,text,text,text,integer,integer),public.update_modifier_group(uuid,text,text,integer,integer,boolean),public.create_modifier_option(uuid,text,text,text,numeric,uuid,numeric),public.update_modifier_option(uuid,text,text,numeric,uuid,numeric,boolean),public.set_product_modifier_groups(uuid,uuid[]) from public,anon;
grant execute on function public.create_modifier_group(uuid,text,text,text,integer,integer),public.update_modifier_group(uuid,text,text,integer,integer,boolean),public.create_modifier_option(uuid,text,text,text,numeric,uuid,numeric),public.update_modifier_option(uuid,text,text,numeric,uuid,numeric,boolean),public.set_product_modifier_groups(uuid,uuid[]) to authenticated;
