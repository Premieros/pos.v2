create or replace function app_private.open_shift_internal(p_branch_id uuid, p_opening_balance numeric)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_opening_balance < 0 then raise exception 'opening balance cannot be negative'; end if;
  if not app_private.current_user_has_permission('shifts.open', p_branch_id) and not app_private.current_user_has_permission('shifts.manage', p_branch_id) then raise exception 'permission denied'; end if;
  insert into public.shifts(branch_id,user_id,opening_balance,opened_by) values(p_branch_id,v_user,p_opening_balance,v_user) returning id into v_id;
  return v_id;
end;$$;

create or replace function app_private.record_cash_drawer_movement_internal(p_shift_id uuid,p_branch_id uuid,p_movement_type text,p_amount numeric,p_reason text,p_idempotency_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_user uuid := auth.uid(); v_owner uuid; v_status text;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_movement_type not in ('cash_in','cash_out') then raise exception 'invalid movement type'; end if;
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;
  select user_id,status into v_owner,v_status from public.shifts where id=p_shift_id and branch_id=p_branch_id for update;
  if not found then raise exception 'shift not found'; end if;
  if v_status <> 'open' then raise exception 'shift is closed'; end if;
  if not app_private.current_user_has_permission('shifts.cash.move', p_branch_id) and not app_private.current_user_has_permission('shifts.manage', p_branch_id) then raise exception 'permission denied'; end if;
  if v_owner <> v_user and not app_private.current_user_has_permission('shifts.manage', p_branch_id) then raise exception 'cannot modify another user shift'; end if;
  select id into v_id from public.cash_drawer_movements where branch_id=p_branch_id and idempotency_key=p_idempotency_key;
  if v_id is not null then return v_id; end if;
  insert into public.cash_drawer_movements(branch_id,shift_id,movement_type,amount,reason,idempotency_key,created_by)
  values(p_branch_id,p_shift_id,p_movement_type,p_amount,trim(p_reason),p_idempotency_key,v_user) returning id into v_id;
  return v_id;
end;$$;

create or replace function app_private.close_shift_internal(p_shift_id uuid,p_branch_id uuid,p_actual_cash numeric,p_note text default null)
returns public.shifts language plpgsql security definer set search_path='' as $$
declare v_user uuid := auth.uid(); v_owner uuid; v_status text; v_opening numeric; v_expected numeric; v_result public.shifts;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_actual_cash < 0 then raise exception 'actual cash cannot be negative'; end if;
  select user_id,status,opening_balance into v_owner,v_status,v_opening from public.shifts where id=p_shift_id and branch_id=p_branch_id for update;
  if not found then raise exception 'shift not found'; end if;
  if v_status <> 'open' then raise exception 'shift already closed'; end if;
  if v_owner = v_user then
    if not app_private.current_user_has_permission('shifts.close', p_branch_id) and not app_private.current_user_has_permission('shifts.manage', p_branch_id) then raise exception 'permission denied'; end if;
  elsif not app_private.current_user_has_permission('shifts.manage', p_branch_id) then raise exception 'cannot close another user shift'; end if;
  select v_opening + coalesce(sum(case when movement_type='cash_in' then amount else -amount end),0) into v_expected from public.cash_drawer_movements where shift_id=p_shift_id and branch_id=p_branch_id;
  update public.shifts set status='closed',expected_cash=v_expected,actual_cash=p_actual_cash,cash_difference=p_actual_cash-v_expected,closed_at=now(),closed_by=v_user,close_note=nullif(trim(p_note),'') where id=p_shift_id and branch_id=p_branch_id returning * into v_result;
  return v_result;
end;$$;

revoke all on function app_private.open_shift_internal(uuid,numeric) from public;
revoke all on function app_private.record_cash_drawer_movement_internal(uuid,uuid,text,numeric,text,uuid) from public;
revoke all on function app_private.close_shift_internal(uuid,uuid,numeric,text) from public;
grant usage on schema app_private to authenticated;
grant execute on function app_private.open_shift_internal(uuid,numeric) to authenticated;
grant execute on function app_private.record_cash_drawer_movement_internal(uuid,uuid,text,numeric,text,uuid) to authenticated;
grant execute on function app_private.close_shift_internal(uuid,uuid,numeric,text) to authenticated;

create or replace function public.open_shift(p_branch_id uuid,p_opening_balance numeric) returns uuid language sql security invoker set search_path='' as $$ select app_private.open_shift_internal(p_branch_id,p_opening_balance); $$;
create or replace function public.record_cash_drawer_movement(p_shift_id uuid,p_branch_id uuid,p_movement_type text,p_amount numeric,p_reason text,p_idempotency_key uuid) returns uuid language sql security invoker set search_path='' as $$ select app_private.record_cash_drawer_movement_internal(p_shift_id,p_branch_id,p_movement_type,p_amount,p_reason,p_idempotency_key); $$;
create or replace function public.close_shift(p_shift_id uuid,p_branch_id uuid,p_actual_cash numeric,p_note text default null) returns public.shifts language sql security invoker set search_path='' as $$ select * from app_private.close_shift_internal(p_shift_id,p_branch_id,p_actual_cash,p_note); $$;
grant execute on function public.open_shift(uuid,numeric) to authenticated;
grant execute on function public.record_cash_drawer_movement(uuid,uuid,text,numeric,text,uuid) to authenticated;
grant execute on function public.close_shift(uuid,uuid,numeric,text) to authenticated;
