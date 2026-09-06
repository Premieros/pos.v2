alter table public.products add column if not exists image_url text;
alter table public.products drop constraint if exists products_image_url_length_chk;
alter table public.products add constraint products_image_url_length_chk check (image_url is null or char_length(image_url) <= 2048);

create or replace function app_private.update_product_image_url_internal(p_product_id uuid,p_image_url text)
returns void language plpgsql security definer set search_path=''
as $$
declare v_branch uuid; v_url text:=nullif(trim(p_image_url),'');
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select branch_id into v_branch from public.products where id=p_product_id for update;
  if v_branch is null then raise exception 'product not found'; end if;
  if not app_private.current_user_has_permission('catalog.manage',v_branch) then raise exception 'permission denied'; end if;
  if v_url is not null and char_length(v_url)>2048 then raise exception 'image URL too long'; end if;
  update public.products set image_url=v_url,updated_at=now() where id=p_product_id;
end $$;

create or replace function public.update_product_image_url(p_product_id uuid,p_image_url text default null)
returns void language sql set search_path=''
as $$ select app_private.update_product_image_url_internal(p_product_id,p_image_url); $$;

revoke all on function app_private.update_product_image_url_internal(uuid,text) from public,anon;
grant execute on function app_private.update_product_image_url_internal(uuid,text) to authenticated;
revoke all on function public.update_product_image_url(uuid,text) from public,anon;
grant execute on function public.update_product_image_url(uuid,text) to authenticated;

create or replace function app_private.get_pos_product_availability_internal(p_branch_id uuid,p_warehouse_id uuid)
returns table(product_id uuid,available_quantity numeric,is_available boolean,reason text)
language sql security definer set search_path=''
as $$
  with permitted as (
    select app_private.current_user_has_permission('pos.view',p_branch_id) ok
  ),
  stock as (
    select sm.inventory_item_id,coalesce(sum(sm.quantity_delta),0)::numeric qty
    from public.stock_movements sm
    where sm.branch_id=p_branch_id and sm.warehouse_id=p_warehouse_id
    group by sm.inventory_item_id
  ),
  component_availability as (
    select pc.product_id,
      min(coalesce(s.qty,0)/nullif(pc.quantity,0))::numeric available_qty
    from public.product_components pc
    left join stock s on s.inventory_item_id=pc.inventory_item_id
    where pc.branch_id=p_branch_id
    group by pc.product_id
  )
  select p.id,
    case
      when exists(select 1 from public.product_components pc where pc.branch_id=p_branch_id and pc.product_id=p.id)
        then greatest(coalesce(ca.available_qty,0),0)
      when p.inventory_item_id is not null then greatest(coalesce(s.qty,0),0)
      else 0::numeric
    end as available_quantity,
    case
      when exists(select 1 from public.product_components pc where pc.branch_id=p_branch_id and pc.product_id=p.id)
        then coalesce(ca.available_qty,0) >= 1
      when p.inventory_item_id is not null then coalesce(s.qty,0) >= 1
      else false
    end as is_available,
    case
      when not exists(select 1 from permitted where ok) then 'permission_denied'
      when not exists(select 1 from public.warehouses w where w.id=p_warehouse_id and w.branch_id=p_branch_id and w.is_active) then 'warehouse_unavailable'
      when exists(select 1 from public.product_components pc where pc.branch_id=p_branch_id and pc.product_id=p.id) and coalesce(ca.available_qty,0)<1 then 'insufficient_components'
      when p.inventory_item_id is not null and coalesce(s.qty,0)<1 then 'out_of_stock'
      when p.inventory_item_id is null and not exists(select 1 from public.product_components pc where pc.branch_id=p_branch_id and pc.product_id=p.id) then 'inventory_mapping_required'
      else 'available'
    end as reason
  from public.products p
  cross join permitted perm
  left join component_availability ca on ca.product_id=p.id
  left join stock s on s.inventory_item_id=p.inventory_item_id
  where p.branch_id=p_branch_id and p.is_active and perm.ok
    and exists(select 1 from public.warehouses w where w.id=p_warehouse_id and w.branch_id=p_branch_id and w.is_active)
  order by p.name_ar;
$$;

create or replace function public.get_pos_product_availability(p_branch_id uuid,p_warehouse_id uuid)
returns table(product_id uuid,available_quantity numeric,is_available boolean,reason text)
language sql set search_path=''
as $$ select * from app_private.get_pos_product_availability_internal(p_branch_id,p_warehouse_id); $$;

revoke all on function app_private.get_pos_product_availability_internal(uuid,uuid) from public,anon;
grant execute on function app_private.get_pos_product_availability_internal(uuid,uuid) to authenticated;
revoke all on function public.get_pos_product_availability(uuid,uuid) from public,anon;
grant execute on function public.get_pos_product_availability(uuid,uuid) to authenticated;