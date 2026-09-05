create or replace function app_private.current_stock_quantity(
  p_branch_id uuid,
  p_warehouse_id uuid,
  p_inventory_item_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(sm.quantity_delta), 0)
  from public.stock_movements sm
  where sm.branch_id = p_branch_id
    and sm.warehouse_id = p_warehouse_id
    and sm.inventory_item_id = p_inventory_item_id;
$$;

create or replace function app_private.record_stock_movement(
  p_branch_id uuid,
  p_warehouse_id uuid,
  p_inventory_item_id uuid,
  p_movement_type text,
  p_quantity_delta numeric,
  p_idempotency_key text,
  p_note text default null,
  p_reference_type text default null,
  p_reference_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_required_permission text;
  v_movement_id uuid;
  v_current numeric;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  v_required_permission := case p_movement_type
    when 'opening' then 'inventory.receive'
    when 'receipt' then 'inventory.receive'
    when 'adjustment' then 'inventory.adjust'
    when 'waste' then 'inventory.waste'
    when 'count_adjustment' then 'inventory.count'
    when 'return_in' then 'inventory.receive'
    when 'return_out' then 'inventory.adjust'
    else null
  end;

  if v_required_permission is null then
    raise exception 'movement type is not available through this command';
  end if;

  if not app_private.has_permission(v_required_permission, p_branch_id, auth.uid()) then
    raise exception 'permission denied';
  end if;

  if p_quantity_delta = 0 then
    raise exception 'quantity delta cannot be zero';
  end if;

  if p_movement_type in ('opening','receipt','return_in') and p_quantity_delta <= 0 then
    raise exception 'inbound movement quantity must be positive';
  end if;

  if p_movement_type in ('waste','return_out') and p_quantity_delta >= 0 then
    raise exception 'outbound movement quantity must be negative';
  end if;

  perform 1 from public.warehouses w
  where w.id = p_warehouse_id and w.branch_id = p_branch_id and w.is_active;
  if not found then raise exception 'active warehouse not found in branch'; end if;

  perform 1 from public.inventory_items i
  where i.id = p_inventory_item_id and i.branch_id = p_branch_id and i.is_active;
  if not found then raise exception 'active inventory item not found in branch'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_warehouse_id::text || ':' || p_inventory_item_id::text, 0));

  if p_quantity_delta < 0 then
    v_current := app_private.current_stock_quantity(p_branch_id, p_warehouse_id, p_inventory_item_id);
    if v_current + p_quantity_delta < 0 then
      raise exception 'insufficient stock';
    end if;
  end if;

  if p_idempotency_key is not null then
    select sm.id into v_movement_id
    from public.stock_movements sm
    where sm.branch_id = p_branch_id and sm.idempotency_key = p_idempotency_key;
    if v_movement_id is not null then
      return v_movement_id;
    end if;
  end if;

  insert into public.stock_movements(
    branch_id, warehouse_id, inventory_item_id, movement_type,
    quantity_delta, reference_type, reference_id, idempotency_key,
    note, created_by
  ) values (
    p_branch_id, p_warehouse_id, p_inventory_item_id, p_movement_type,
    p_quantity_delta, p_reference_type, p_reference_id, p_idempotency_key,
    nullif(btrim(p_note), ''), auth.uid()
  ) returning id into v_movement_id;

  return v_movement_id;
end;
$$;

create or replace function public.record_stock_movement(
  p_branch_id uuid,
  p_warehouse_id uuid,
  p_inventory_item_id uuid,
  p_movement_type text,
  p_quantity_delta numeric,
  p_idempotency_key text,
  p_note text default null,
  p_reference_type text default null,
  p_reference_id uuid default null
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select app_private.record_stock_movement(
    p_branch_id, p_warehouse_id, p_inventory_item_id, p_movement_type,
    p_quantity_delta, p_idempotency_key, p_note, p_reference_type, p_reference_id
  );
$$;

create or replace function app_private.transfer_stock(
  p_branch_id uuid,
  p_from_warehouse_id uuid,
  p_to_warehouse_id uuid,
  p_inventory_item_id uuid,
  p_quantity numeric,
  p_idempotency_key text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transfer_id uuid := gen_random_uuid();
  v_current numeric;
  v_existing uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not app_private.has_permission('inventory.transfer', p_branch_id, auth.uid()) then raise exception 'permission denied'; end if;
  if p_quantity <= 0 then raise exception 'transfer quantity must be positive'; end if;
  if p_from_warehouse_id = p_to_warehouse_id then raise exception 'source and destination warehouses must differ'; end if;
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then raise exception 'idempotency key required'; end if;

  select sm.reference_id into v_existing
  from public.stock_movements sm
  where sm.branch_id = p_branch_id
    and sm.idempotency_key = p_idempotency_key || ':out';
  if v_existing is not null then return v_existing; end if;

  perform 1 from public.warehouses w where w.id = p_from_warehouse_id and w.branch_id = p_branch_id and w.is_active;
  if not found then raise exception 'source warehouse not found in branch'; end if;
  perform 1 from public.warehouses w where w.id = p_to_warehouse_id and w.branch_id = p_branch_id and w.is_active;
  if not found then raise exception 'destination warehouse not found in branch'; end if;
  perform 1 from public.inventory_items i where i.id = p_inventory_item_id and i.branch_id = p_branch_id and i.is_active;
  if not found then raise exception 'active inventory item not found in branch'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_from_warehouse_id::text || ':' || p_inventory_item_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(p_to_warehouse_id::text || ':' || p_inventory_item_id::text, 0));

  v_current := app_private.current_stock_quantity(p_branch_id, p_from_warehouse_id, p_inventory_item_id);
  if v_current < p_quantity then raise exception 'insufficient stock'; end if;

  insert into public.stock_movements(
    branch_id, warehouse_id, inventory_item_id, movement_type, quantity_delta,
    reference_type, reference_id, idempotency_key, note, created_by
  ) values
  (p_branch_id, p_from_warehouse_id, p_inventory_item_id, 'transfer_out', -p_quantity,
   'warehouse_transfer', v_transfer_id, p_idempotency_key || ':out', nullif(btrim(p_note), ''), auth.uid()),
  (p_branch_id, p_to_warehouse_id, p_inventory_item_id, 'transfer_in', p_quantity,
   'warehouse_transfer', v_transfer_id, p_idempotency_key || ':in', nullif(btrim(p_note), ''), auth.uid());

  return v_transfer_id;
end;
$$;

create or replace function public.transfer_stock(
  p_branch_id uuid,
  p_from_warehouse_id uuid,
  p_to_warehouse_id uuid,
  p_inventory_item_id uuid,
  p_quantity numeric,
  p_idempotency_key text,
  p_note text default null
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select app_private.transfer_stock(
    p_branch_id, p_from_warehouse_id, p_to_warehouse_id,
    p_inventory_item_id, p_quantity, p_idempotency_key, p_note
  );
$$;

grant usage on schema app_private to authenticated;
revoke all on function app_private.current_stock_quantity(uuid, uuid, uuid) from public, anon;
revoke all on function app_private.record_stock_movement(uuid, uuid, uuid, text, numeric, text, text, text, uuid) from public, anon;
revoke all on function app_private.transfer_stock(uuid, uuid, uuid, uuid, numeric, text, text) from public, anon;
grant execute on function app_private.record_stock_movement(uuid, uuid, uuid, text, numeric, text, text, text, uuid) to authenticated;
grant execute on function app_private.transfer_stock(uuid, uuid, uuid, uuid, numeric, text, text) to authenticated;
grant execute on function public.record_stock_movement(uuid, uuid, uuid, text, numeric, text, text, text, uuid) to authenticated;
grant execute on function public.transfer_stock(uuid, uuid, uuid, uuid, numeric, text, text) to authenticated;
