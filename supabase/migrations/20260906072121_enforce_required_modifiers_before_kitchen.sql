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
  v_missing_required boolean;
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

  select exists (
    select 1
    from public.order_items oi
    join public.product_modifier_groups pmg
      on pmg.product_id = oi.product_id and pmg.branch_id = oi.branch_id
    join public.modifier_groups mg
      on mg.id = pmg.group_id and mg.branch_id = pmg.branch_id and mg.is_active and mg.min_select > 0
    where oi.order_id = new.order_id
      and oi.branch_id = new.branch_id
      and not oi.is_removed
      and oi.quantity > 0
      and (
        select count(*)
        from public.order_item_modifiers oim
        join public.modifier_options mo
          on mo.id = oim.modifier_option_id and mo.branch_id = oim.branch_id and mo.is_active
        where oim.order_item_id = oi.id
          and oim.branch_id = oi.branch_id
          and oim.modifier_group_id = mg.id
      ) < mg.min_select
  ) into v_missing_required;

  if v_missing_required then
    raise exception 'required product modifiers must be selected before kitchen send';
  end if;

  return new;
end;
$$;

revoke all on function app_private.validate_kitchen_order_context_trigger() from public, anon, authenticated;
