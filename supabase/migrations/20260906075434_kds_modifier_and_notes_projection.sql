create or replace function app_private.update_order_notes_internal(p_order_id uuid,p_notes text)
returns void language plpgsql security definer set search_path=''
as $$
declare v_branch uuid; v_status text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select branch_id,status into v_branch,v_status from public.orders where id=p_order_id for update;
  if v_branch is null then raise exception 'order not found'; end if;
  if not app_private.current_user_has_permission('pos.order.edit',v_branch) then raise exception 'permission denied'; end if;
  if v_status not in ('created','held') then raise exception 'order notes are locked after first kitchen send'; end if;
  update public.orders set notes=nullif(trim(p_notes),''),updated_at=now() where id=p_order_id;
end $$;

create or replace function app_private.update_order_item_notes_internal(p_order_item_id uuid,p_notes text)
returns void language plpgsql security definer set search_path=''
as $$
declare v_branch uuid; v_status text; v_sent numeric;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select oi.branch_id,o.status,oi.sent_quantity into v_branch,v_status,v_sent
  from public.order_items oi join public.orders o on o.id=oi.order_id where oi.id=p_order_item_id for update of oi;
  if v_branch is null then raise exception 'order item not found'; end if;
  if not app_private.current_user_has_permission('pos.order.edit',v_branch) then raise exception 'permission denied'; end if;
  if v_status not in ('created','held','sent_to_kitchen','preparing') or coalesce(v_sent,0)<>0 then raise exception 'line notes are locked after first kitchen send; replace the line instead'; end if;
  update public.order_items set notes=nullif(trim(p_notes),''),updated_at=now() where id=p_order_item_id;
end $$;

create or replace function public.update_order_notes(p_order_id uuid,p_notes text default null)
returns void language sql set search_path='' as $$ select app_private.update_order_notes_internal(p_order_id,p_notes); $$;
create or replace function public.update_order_item_notes(p_order_item_id uuid,p_notes text default null)
returns void language sql set search_path='' as $$ select app_private.update_order_item_notes_internal(p_order_item_id,p_notes); $$;

revoke all on function app_private.update_order_notes_internal(uuid,text),app_private.update_order_item_notes_internal(uuid,text) from public,anon;
grant execute on function app_private.update_order_notes_internal(uuid,text),app_private.update_order_item_notes_internal(uuid,text) to authenticated;
revoke all on function public.update_order_notes(uuid,text),public.update_order_item_notes(uuid,text) from public,anon;
grant execute on function public.update_order_notes(uuid,text),public.update_order_item_notes(uuid,text) to authenticated;

create or replace function app_private.get_kitchen_ticket_details_internal(p_branch_id uuid)
returns table(kitchen_ticket_id uuid,kitchen_ticket_item_id uuid,order_item_id uuid,product_name text,quantity_delta numeric,line_notes text,modifier_summary text)
language sql security definer set search_path=''
as $$
  select kti.kitchen_ticket_id,kti.id,kti.order_item_id,kti.product_name,kti.quantity_delta,
    oi.notes,
    nullif(string_agg(oim.option_name_snapshot || case when oim.quantity<>1 then ' ×' || trim(to_char(oim.quantity,'FM999999990.###')) else '' end,'، ' order by oim.created_at),'') as modifier_summary
  from public.kitchen_ticket_items kti
  join public.kitchen_tickets kt on kt.id=kti.kitchen_ticket_id and kt.branch_id=kti.branch_id
  left join public.order_items oi on oi.id=kti.order_item_id and oi.branch_id=kti.branch_id
  left join public.order_item_modifiers oim on oim.order_item_id=kti.order_item_id and oim.branch_id=kti.branch_id
  where kt.branch_id=p_branch_id
    and kt.status in ('queued','preparing','ready')
    and (app_private.current_user_has_permission('kitchen.view',p_branch_id) or app_private.current_user_has_permission('kitchen.manage',p_branch_id))
  group by kti.kitchen_ticket_id,kti.id,kti.order_item_id,kti.product_name,kti.quantity_delta,oi.notes
  order by kti.created_at;
$$;

create or replace function public.get_kitchen_ticket_details(p_branch_id uuid)
returns table(kitchen_ticket_id uuid,kitchen_ticket_item_id uuid,order_item_id uuid,product_name text,quantity_delta numeric,line_notes text,modifier_summary text)
language sql set search_path='' as $$ select * from app_private.get_kitchen_ticket_details_internal(p_branch_id); $$;

revoke all on function app_private.get_kitchen_ticket_details_internal(uuid) from public,anon;
grant execute on function app_private.get_kitchen_ticket_details_internal(uuid) to authenticated;
revoke all on function public.get_kitchen_ticket_details(uuid) from public,anon;
grant execute on function public.get_kitchen_ticket_details(uuid) to authenticated;