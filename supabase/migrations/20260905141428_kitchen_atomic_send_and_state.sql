create or replace function app_private.send_order_to_kitchen_internal(p_order_id uuid,p_warehouse_id uuid,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid(); v_branch_id uuid; v_order_status text; v_ticket_id uuid; v_existing uuid; v_seq integer; v_key text:=nullif(trim(p_idempotency_key),'');
  r record; c record; v_desired numeric; v_delta numeric; v_stock_delta numeric; v_available numeric;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if v_key is null then raise exception 'idempotency key required'; end if;
  select branch_id,status into v_branch_id,v_order_status from public.orders where id=p_order_id for update;
  if v_branch_id is null then raise exception 'order not found'; end if;
  if not app_private.current_user_has_permission('pos.send_kitchen',v_branch_id) then raise exception 'permission denied'; end if;
  if v_order_status not in ('created','sent_to_kitchen','preparing') then raise exception 'order cannot be sent to kitchen in current state'; end if;
  if not exists(select 1 from public.warehouses where id=p_warehouse_id and branch_id=v_branch_id and is_active) then raise exception 'warehouse unavailable'; end if;
  select id into v_existing from public.kitchen_tickets where branch_id=v_branch_id and idempotency_key=v_key;
  if v_existing is not null then return v_existing; end if;
  if not exists(select 1 from public.order_items oi where oi.order_id=p_order_id and ((case when oi.is_removed then 0 else oi.quantity end)-oi.sent_quantity)<>0) then raise exception 'no kitchen changes to send'; end if;
  select coalesce(max(sequence_no),0)+1 into v_seq from public.kitchen_tickets where order_id=p_order_id;
  insert into public.kitchen_tickets(branch_id,order_id,sequence_no,warehouse_id,idempotency_key,created_by)
  values(v_branch_id,p_order_id,v_seq,p_warehouse_id,v_key,v_user_id) returning id into v_ticket_id;

  for r in
    select oi.id as order_item_id,oi.product_id,oi.product_name,oi.quantity,oi.sent_quantity,oi.is_removed,p.inventory_item_id
    from public.order_items oi join public.products p on p.id=oi.product_id and p.branch_id=oi.branch_id
    where oi.order_id=p_order_id
  loop
    v_desired:=case when r.is_removed then 0 else r.quantity end;
    v_delta:=v_desired-r.sent_quantity;
    if v_delta=0 then continue; end if;
    insert into public.kitchen_ticket_items(branch_id,kitchen_ticket_id,order_item_id,product_name,quantity_delta)
    values(v_branch_id,v_ticket_id,r.order_item_id,r.product_name,v_delta);

    if exists(select 1 from public.product_components pc where pc.branch_id=v_branch_id and pc.product_id=r.product_id) then
      for c in select inventory_item_id,quantity from public.product_components where branch_id=v_branch_id and product_id=r.product_id loop
        v_stock_delta:=-(c.quantity*v_delta);
        if v_stock_delta<0 then
          select coalesce(sum(quantity_delta),0) into v_available from public.stock_movements where branch_id=v_branch_id and warehouse_id=p_warehouse_id and inventory_item_id=c.inventory_item_id;
          if v_available+v_stock_delta<0 then raise exception 'insufficient inventory for %',r.product_name; end if;
        end if;
        insert into public.stock_movements(branch_id,warehouse_id,inventory_item_id,movement_type,quantity_delta,reference_type,reference_id,note,idempotency_key,created_by)
        values(v_branch_id,p_warehouse_id,c.inventory_item_id,case when v_stock_delta<0 then 'sale_consumption' else 'return_in' end,v_stock_delta,'kitchen_ticket',v_ticket_id,'Kitchen delta: '||r.product_name,v_key||':'||r.order_item_id::text||':'||c.inventory_item_id::text,v_user_id);
      end loop;
    elsif r.inventory_item_id is not null then
      v_stock_delta:=-v_delta;
      if v_stock_delta<0 then
        select coalesce(sum(quantity_delta),0) into v_available from public.stock_movements where branch_id=v_branch_id and warehouse_id=p_warehouse_id and inventory_item_id=r.inventory_item_id;
        if v_available+v_stock_delta<0 then raise exception 'insufficient inventory for %',r.product_name; end if;
      end if;
      insert into public.stock_movements(branch_id,warehouse_id,inventory_item_id,movement_type,quantity_delta,reference_type,reference_id,note,idempotency_key,created_by)
      values(v_branch_id,p_warehouse_id,r.inventory_item_id,case when v_stock_delta<0 then 'sale_consumption' else 'return_in' end,v_stock_delta,'kitchen_ticket',v_ticket_id,'Kitchen delta: '||r.product_name,v_key||':'||r.order_item_id::text||':'||r.inventory_item_id::text,v_user_id);
    else
      raise exception 'inventory mapping required for product %',r.product_name;
    end if;
    update public.order_items set sent_quantity=v_desired,updated_at=now() where id=r.order_item_id;
  end loop;
  update public.orders set status=case when status='created' then 'sent_to_kitchen' else status end,updated_at=now() where id=p_order_id;
  return v_ticket_id;
end $$;

create or replace function app_private.update_kitchen_ticket_status_internal(p_ticket_id uuid,p_status text)
returns void language plpgsql security definer set search_path=''
as $$
declare v_branch_id uuid; v_order_id uuid; v_current text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_status not in ('preparing','ready','completed') then raise exception 'invalid kitchen status'; end if;
  select branch_id,order_id,status into v_branch_id,v_order_id,v_current from public.kitchen_tickets where id=p_ticket_id for update;
  if v_branch_id is null then raise exception 'ticket not found'; end if;
  if not (app_private.current_user_has_permission('kitchen.ticket.update',v_branch_id) or app_private.current_user_has_permission('kitchen.manage',v_branch_id)) then raise exception 'permission denied'; end if;
  if (v_current='queued' and p_status<>'preparing') or (v_current='preparing' and p_status not in ('ready','completed')) or (v_current='ready' and p_status<>'completed') or v_current in ('completed','cancelled') then raise exception 'invalid kitchen transition'; end if;
  update public.kitchen_tickets set status=p_status,
    started_at=case when p_status='preparing' and started_at is null then now() else started_at end,
    ready_at=case when p_status='ready' and ready_at is null then now() else ready_at end,
    completed_at=case when p_status='completed' and completed_at is null then now() else completed_at end
  where id=p_ticket_id;
  if p_status='preparing' then
    update public.orders set status='preparing',updated_at=now() where id=v_order_id and status in ('sent_to_kitchen','preparing');
  elsif p_status in ('ready','completed') and not exists(select 1 from public.kitchen_tickets kt where kt.order_id=v_order_id and kt.id<>p_ticket_id and kt.status not in ('ready','completed','cancelled')) then
    update public.orders set status='ready',updated_at=now() where id=v_order_id and status in ('sent_to_kitchen','preparing','ready');
  end if;
end $$;

grant usage on schema app_private to authenticated;
revoke all on function app_private.send_order_to_kitchen_internal(uuid,uuid,text),app_private.update_kitchen_ticket_status_internal(uuid,text) from public,anon;
grant execute on function app_private.send_order_to_kitchen_internal(uuid,uuid,text),app_private.update_kitchen_ticket_status_internal(uuid,text) to authenticated;

create or replace function public.send_order_to_kitchen(p_order_id uuid,p_warehouse_id uuid,p_idempotency_key text)
returns uuid language sql security invoker set search_path='' as $$ select app_private.send_order_to_kitchen_internal(p_order_id,p_warehouse_id,p_idempotency_key); $$;
create or replace function public.update_kitchen_ticket_status(p_ticket_id uuid,p_status text)
returns void language sql security invoker set search_path='' as $$ select app_private.update_kitchen_ticket_status_internal(p_ticket_id,p_status); $$;
revoke all on function public.send_order_to_kitchen(uuid,uuid,text),public.update_kitchen_ticket_status(uuid,text) from public,anon;
grant execute on function public.send_order_to_kitchen(uuid,uuid,text),public.update_kitchen_ticket_status(uuid,text) to authenticated;

create or replace function app_private.add_pos_order_item_internal(p_order_id uuid,p_product_id uuid,p_quantity numeric,p_notes text default null)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_branch_id uuid; v_status text; v_name text; v_price numeric(14,2); v_item_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_quantity<=0 then raise exception 'quantity must be positive'; end if;
  select branch_id,status into v_branch_id,v_status from public.orders where id=p_order_id for update;
  if v_branch_id is null then raise exception 'order not found'; end if;
  if not app_private.current_user_has_permission('pos.order.edit',v_branch_id) then raise exception 'permission denied'; end if;
  if v_status not in ('created','held','sent_to_kitchen','preparing') then raise exception 'order cannot be edited in current state'; end if;
  select name_ar,sale_price into v_name,v_price from public.products where id=p_product_id and branch_id=v_branch_id and is_active;
  if v_name is null then raise exception 'product unavailable'; end if;
  insert into public.order_items(branch_id,order_id,product_id,product_name,unit_price,quantity,line_total,notes)
  values(v_branch_id,p_order_id,p_product_id,v_name,v_price,p_quantity,round(v_price*p_quantity,2),nullif(trim(p_notes),'')) returning id into v_item_id;
  perform app_private.recalculate_order_totals(p_order_id); return v_item_id;
end $$;

create or replace function app_private.set_pos_order_item_quantity_internal(p_order_item_id uuid,p_quantity numeric)
returns void language plpgsql security definer set search_path=''
as $$
declare v_order_id uuid; v_branch_id uuid; v_status text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_quantity<=0 then raise exception 'quantity must be positive'; end if;
  select oi.order_id,oi.branch_id,o.status into v_order_id,v_branch_id,v_status from public.order_items oi join public.orders o on o.id=oi.order_id where oi.id=p_order_item_id for update of oi,o;
  if v_order_id is null then raise exception 'order item not found'; end if;
  if not app_private.current_user_has_permission('pos.order.edit',v_branch_id) then raise exception 'permission denied'; end if;
  if v_status not in ('created','held','sent_to_kitchen','preparing') then raise exception 'order cannot be edited in current state'; end if;
  update public.order_items set quantity=p_quantity,line_total=round(unit_price*p_quantity,2),is_removed=false,updated_at=now() where id=p_order_item_id;
  perform app_private.recalculate_order_totals(v_order_id);
end $$;

create or replace function app_private.remove_pos_order_item_internal(p_order_item_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_order_id uuid; v_branch_id uuid; v_status text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select oi.order_id,oi.branch_id,o.status into v_order_id,v_branch_id,v_status from public.order_items oi join public.orders o on o.id=oi.order_id where oi.id=p_order_item_id for update of oi,o;
  if v_order_id is null then raise exception 'order item not found'; end if;
  if not app_private.current_user_has_permission('pos.order.edit',v_branch_id) then raise exception 'permission denied'; end if;
  if v_status not in ('created','held','sent_to_kitchen','preparing') then raise exception 'order cannot be edited in current state'; end if;
  update public.order_items set is_removed=true,updated_at=now() where id=p_order_item_id;
  perform app_private.recalculate_order_totals(v_order_id);
end $$;
