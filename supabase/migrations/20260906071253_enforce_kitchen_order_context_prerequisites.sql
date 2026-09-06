create or replace function app_private.validate_kitchen_order_context_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_type text;
  v_customer_id uuid;
  v_delivery_address_id uuid;
  v_drive_thru_reference text;
begin
  select o.order_type, o.customer_id, o.delivery_address_id, o.drive_thru_reference
    into v_order_type, v_customer_id, v_delivery_address_id, v_drive_thru_reference
  from public.orders o
  where o.id = new.order_id and o.branch_id = new.branch_id;

  if v_order_type is null then
    raise exception 'order not found for kitchen ticket';
  end if;

  if v_order_type = 'delivery' and (v_customer_id is null or v_delivery_address_id is null) then
    raise exception 'delivery customer and address required before kitchen send';
  end if;

  if v_order_type = 'drive_thru' and nullif(trim(v_drive_thru_reference), '') is null then
    raise exception 'drive-thru reference required before kitchen send';
  end if;

  return new;
end;
$$;

revoke all on function app_private.validate_kitchen_order_context_trigger() from public;
revoke all on function app_private.validate_kitchen_order_context_trigger() from anon;
revoke all on function app_private.validate_kitchen_order_context_trigger() from authenticated;

drop trigger if exists trg_validate_kitchen_order_context on public.kitchen_tickets;
create trigger trg_validate_kitchen_order_context
before insert on public.kitchen_tickets
for each row execute function app_private.validate_kitchen_order_context_trigger();
