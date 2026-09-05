revoke update on public.products from authenticated;
grant update(category_id,sku,barcode,name_ar,name_en,sale_price,is_active,updated_at) on public.products to authenticated;

create or replace function app_private.prevent_mixed_product_inventory_mapping()
returns trigger language plpgsql set search_path=''
as $$
begin
  if tg_table_name='product_components' then
    if exists(select 1 from public.products p where p.id=new.product_id and p.branch_id=new.branch_id and p.inventory_item_id is not null) then
      raise exception 'product already uses direct inventory mapping';
    end if;
    return new;
  end if;
  if new.inventory_item_id is not null and exists(select 1 from public.product_components pc where pc.product_id=new.id and pc.branch_id=new.branch_id) then
    raise exception 'product already has BOM components';
  end if;
  return new;
end $$;

drop trigger if exists trg_product_components_no_mixed_mapping on public.product_components;
create trigger trg_product_components_no_mixed_mapping before insert or update on public.product_components for each row execute function app_private.prevent_mixed_product_inventory_mapping();
drop trigger if exists trg_products_no_mixed_mapping on public.products;
create trigger trg_products_no_mixed_mapping before update of inventory_item_id on public.products for each row execute function app_private.prevent_mixed_product_inventory_mapping();

create or replace function app_private.set_product_inventory_item_internal(p_product_id uuid,p_inventory_item_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_branch_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select branch_id into v_branch_id from public.products where id=p_product_id for update;
  if v_branch_id is null then raise exception 'product not found'; end if;
  if not (app_private.current_user_has_permission('inventory.setup',v_branch_id) and app_private.current_user_has_permission('catalog.manage',v_branch_id)) then raise exception 'permission denied'; end if;
  if p_inventory_item_id is not null and not exists(select 1 from public.inventory_items where id=p_inventory_item_id and branch_id=v_branch_id and is_active) then raise exception 'inventory item unavailable'; end if;
  update public.products set inventory_item_id=p_inventory_item_id,updated_at=now() where id=p_product_id;
end $$;
revoke all on function app_private.set_product_inventory_item_internal(uuid,uuid) from public,anon;
grant usage on schema app_private to authenticated;
grant execute on function app_private.set_product_inventory_item_internal(uuid,uuid) to authenticated;

create or replace function public.set_product_inventory_item(p_product_id uuid,p_inventory_item_id uuid)
returns void language sql security invoker set search_path='' as $$ select app_private.set_product_inventory_item_internal(p_product_id,p_inventory_item_id); $$;
revoke all on function public.set_product_inventory_item(uuid,uuid) from public,anon;
grant execute on function public.set_product_inventory_item(uuid,uuid) to authenticated;
