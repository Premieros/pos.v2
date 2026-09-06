create or replace function app_private.ensure_order_item_base_unit_price()
returns trigger language plpgsql set search_path=''
as $$
begin
  if new.base_unit_price is null then new.base_unit_price := new.unit_price; end if;
  return new;
end $$;

drop trigger if exists trg_ensure_order_item_base_unit_price on public.order_items;
create trigger trg_ensure_order_item_base_unit_price
before insert on public.order_items
for each row execute function app_private.ensure_order_item_base_unit_price();

revoke all on function app_private.ensure_order_item_base_unit_price() from public,anon,authenticated;

create or replace function app_private.apply_modifier_stock_for_kitchen_ticket_item()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_branch uuid; v_warehouse uuid; r record; v_delta numeric; v_available numeric; v_key text;
begin
  select kt.branch_id,kt.warehouse_id,kt.idempotency_key into v_branch,v_warehouse,v_key from public.kitchen_tickets kt where kt.id=new.kitchen_ticket_id;
  for r in select oim.id selection_id,oim.inventory_item_id_snapshot inventory_item_id,oim.inventory_quantity_snapshot,oim.quantity,oim.option_name_snapshot from public.order_item_modifiers oim where oim.order_item_id=new.order_item_id and oim.inventory_item_id_snapshot is not null and oim.inventory_quantity_snapshot>0 loop
    v_delta := -(new.quantity_delta*r.quantity*r.inventory_quantity_snapshot);
    if v_delta < 0 then
      select coalesce(sum(quantity_delta),0) into v_available from public.stock_movements where branch_id=v_branch and warehouse_id=v_warehouse and inventory_item_id=r.inventory_item_id;
      if v_available+v_delta < 0 then raise exception 'insufficient inventory for modifier %',r.option_name_snapshot; end if;
    end if;
    insert into public.stock_movements(branch_id,warehouse_id,inventory_item_id,movement_type,quantity_delta,reference_type,reference_id,note,idempotency_key,created_by,source_order_item_id)
    values(v_branch,v_warehouse,r.inventory_item_id,case when v_delta<0 then 'sale_consumption' else 'return_in' end,v_delta,'kitchen_ticket',new.kitchen_ticket_id,'Modifier delta: '||r.option_name_snapshot,v_key||':modifier:'||r.selection_id::text,auth.uid(),new.order_item_id);
  end loop;
  return new;
end $$;

revoke all on function app_private.apply_modifier_stock_for_kitchen_ticket_item() from public,anon,authenticated;
