create or replace function app_private.recalculate_order_totals(p_order_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_subtotal numeric(14,2);
begin
  select coalesce(sum(round(oi.unit_price * oi.quantity,2)),0) into v_subtotal
  from public.order_items oi where oi.order_id=p_order_id and not oi.is_removed;
  update public.orders set subtotal=v_subtotal,total=greatest(v_subtotal-discount_total,0),updated_at=now() where id=p_order_id;
end $$;
revoke all on function app_private.recalculate_order_totals(uuid) from public,anon,authenticated;

create or replace function app_private.create_dining_table_internal(p_branch_id uuid,p_code text,p_name text,p_capacity integer default 4,p_floor_name text default null)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not app_private.current_user_has_permission('pos.tables.manage',p_branch_id) then raise exception 'permission denied'; end if;
  if nullif(trim(p_code),'') is null or nullif(trim(p_name),'') is null then raise exception 'table code and name required'; end if;
  if p_capacity<=0 then raise exception 'capacity must be positive'; end if;
  insert into public.dining_tables(branch_id,code,name,capacity,floor_name)
  values(p_branch_id,trim(p_code),trim(p_name),p_capacity,nullif(trim(p_floor_name),'')) returning id into v_id;
  return v_id;
end $$;

create or replace function app_private.create_pos_order_internal(p_branch_id uuid,p_order_type text,p_dining_table_id uuid default null,p_guest_count integer default 1,p_notes text default null,p_idempotency_key text default null)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user_id uuid:=auth.uid(); v_shift_id uuid; v_order_id uuid; v_capacity integer; v_existing uuid; v_key text:=coalesce(nullif(trim(p_idempotency_key),''),gen_random_uuid()::text);
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if not app_private.current_user_has_permission('pos.order.create',p_branch_id) then raise exception 'permission denied'; end if;
  if p_order_type not in ('dine_in','take_away','drive_thru','delivery','quick') then raise exception 'invalid order type'; end if;
  if p_guest_count<0 then raise exception 'guest count cannot be negative'; end if;
  select id into v_existing from public.orders where branch_id=p_branch_id and idempotency_key=v_key;
  if v_existing is not null then return v_existing; end if;
  select id into v_shift_id from public.shifts where branch_id=p_branch_id and user_id=v_user_id and status='open' order by opened_at desc limit 1;
  if v_shift_id is null then raise exception 'open shift required'; end if;
  if p_order_type='dine_in' then
    if p_dining_table_id is null then raise exception 'dine-in order requires table'; end if;
    select capacity into v_capacity from public.dining_tables where id=p_dining_table_id and branch_id=p_branch_id and is_active;
    if v_capacity is null then raise exception 'table unavailable'; end if;
    if p_guest_count>v_capacity then raise exception 'guest count exceeds table capacity'; end if;
    if exists(select 1 from public.orders where branch_id=p_branch_id and dining_table_id=p_dining_table_id and status not in ('closed','cancelled','voided','returned')) then raise exception 'table occupied'; end if;
  elsif p_dining_table_id is not null then raise exception 'table only allowed for dine-in'; end if;
  insert into public.orders(branch_id,shift_id,order_type,dining_table_id,guest_count,notes,idempotency_key,created_by)
  values(p_branch_id,v_shift_id,p_order_type,p_dining_table_id,p_guest_count,nullif(trim(p_notes),''),v_key,v_user_id) returning id into v_order_id;
  return v_order_id;
end $$;

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
  if v_status not in ('created','held') then raise exception 'order cannot be edited in current state'; end if;
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
  if v_status not in ('created','held') then raise exception 'order cannot be edited in current state'; end if;
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
  if v_status not in ('created','held') then raise exception 'order cannot be edited in current state'; end if;
  update public.order_items set is_removed=true,updated_at=now() where id=p_order_item_id;
  perform app_private.recalculate_order_totals(v_order_id);
end $$;

create or replace function app_private.hold_pos_order_internal(p_order_id uuid) returns void language plpgsql security definer set search_path=''
as $$ declare v_branch_id uuid; v_status text; begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select branch_id,status into v_branch_id,v_status from public.orders where id=p_order_id for update;
  if v_branch_id is null then raise exception 'order not found'; end if;
  if not app_private.current_user_has_permission('pos.order.edit',v_branch_id) then raise exception 'permission denied'; end if;
  if v_status<>'created' then raise exception 'only created order can be held'; end if;
  update public.orders set status='held',updated_at=now() where id=p_order_id;
end $$;

create or replace function app_private.resume_pos_order_internal(p_order_id uuid) returns void language plpgsql security definer set search_path=''
as $$ declare v_branch_id uuid; v_status text; begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select branch_id,status into v_branch_id,v_status from public.orders where id=p_order_id for update;
  if v_branch_id is null then raise exception 'order not found'; end if;
  if not app_private.current_user_has_permission('pos.order.edit',v_branch_id) then raise exception 'permission denied'; end if;
  if v_status<>'held' then raise exception 'only held order can be resumed'; end if;
  update public.orders set status='created',updated_at=now() where id=p_order_id;
end $$;

create or replace function app_private.cancel_pos_order_internal(p_order_id uuid,p_reason text) returns void language plpgsql security definer set search_path=''
as $$ declare v_branch_id uuid; v_status text; begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select branch_id,status into v_branch_id,v_status from public.orders where id=p_order_id for update;
  if v_branch_id is null then raise exception 'order not found'; end if;
  if not app_private.current_user_has_permission('pos.order.cancel',v_branch_id) then raise exception 'permission denied'; end if;
  if v_status not in ('created','held') then raise exception 'order cannot be cancelled in current state'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'cancel reason required'; end if;
  update public.orders set status='cancelled',cancelled_at=now(),cancelled_by=auth.uid(),cancel_reason=trim(p_reason),updated_at=now() where id=p_order_id;
end $$;

grant usage on schema app_private to authenticated;
revoke all on function app_private.create_dining_table_internal(uuid,text,text,integer,text),app_private.create_pos_order_internal(uuid,text,uuid,integer,text,text),app_private.add_pos_order_item_internal(uuid,uuid,numeric,text),app_private.set_pos_order_item_quantity_internal(uuid,numeric),app_private.remove_pos_order_item_internal(uuid),app_private.hold_pos_order_internal(uuid),app_private.resume_pos_order_internal(uuid),app_private.cancel_pos_order_internal(uuid,text) from public,anon;
grant execute on function app_private.create_dining_table_internal(uuid,text,text,integer,text),app_private.create_pos_order_internal(uuid,text,uuid,integer,text,text),app_private.add_pos_order_item_internal(uuid,uuid,numeric,text),app_private.set_pos_order_item_quantity_internal(uuid,numeric),app_private.remove_pos_order_item_internal(uuid),app_private.hold_pos_order_internal(uuid),app_private.resume_pos_order_internal(uuid),app_private.cancel_pos_order_internal(uuid,text) to authenticated;

create or replace function public.create_dining_table(p_branch_id uuid,p_code text,p_name text,p_capacity integer default 4,p_floor_name text default null) returns uuid language sql security invoker set search_path='' as $$ select app_private.create_dining_table_internal(p_branch_id,p_code,p_name,p_capacity,p_floor_name); $$;
create or replace function public.create_pos_order(p_branch_id uuid,p_order_type text,p_dining_table_id uuid default null,p_guest_count integer default 1,p_notes text default null,p_idempotency_key text default null) returns uuid language sql security invoker set search_path='' as $$ select app_private.create_pos_order_internal(p_branch_id,p_order_type,p_dining_table_id,p_guest_count,p_notes,p_idempotency_key); $$;
create or replace function public.add_pos_order_item(p_order_id uuid,p_product_id uuid,p_quantity numeric,p_notes text default null) returns uuid language sql security invoker set search_path='' as $$ select app_private.add_pos_order_item_internal(p_order_id,p_product_id,p_quantity,p_notes); $$;
create or replace function public.set_pos_order_item_quantity(p_order_item_id uuid,p_quantity numeric) returns void language sql security invoker set search_path='' as $$ select app_private.set_pos_order_item_quantity_internal(p_order_item_id,p_quantity); $$;
create or replace function public.remove_pos_order_item(p_order_item_id uuid) returns void language sql security invoker set search_path='' as $$ select app_private.remove_pos_order_item_internal(p_order_item_id); $$;
create or replace function public.hold_pos_order(p_order_id uuid) returns void language sql security invoker set search_path='' as $$ select app_private.hold_pos_order_internal(p_order_id); $$;
create or replace function public.resume_pos_order(p_order_id uuid) returns void language sql security invoker set search_path='' as $$ select app_private.resume_pos_order_internal(p_order_id); $$;
create or replace function public.cancel_pos_order(p_order_id uuid,p_reason text) returns void language sql security invoker set search_path='' as $$ select app_private.cancel_pos_order_internal(p_order_id,p_reason); $$;
revoke all on function public.create_dining_table(uuid,text,text,integer,text),public.create_pos_order(uuid,text,uuid,integer,text,text),public.add_pos_order_item(uuid,uuid,numeric,text),public.set_pos_order_item_quantity(uuid,numeric),public.remove_pos_order_item(uuid),public.hold_pos_order(uuid),public.resume_pos_order(uuid),public.cancel_pos_order(uuid,text) from public,anon;
grant execute on function public.create_dining_table(uuid,text,text,integer,text),public.create_pos_order(uuid,text,uuid,integer,text,text),public.add_pos_order_item(uuid,uuid,numeric,text),public.set_pos_order_item_quantity(uuid,numeric),public.remove_pos_order_item(uuid),public.hold_pos_order(uuid),public.resume_pos_order(uuid),public.cancel_pos_order(uuid,text) to authenticated;
