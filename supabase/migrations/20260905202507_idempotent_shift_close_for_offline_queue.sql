create table if not exists app_private.shift_close_command_log (
  idempotency_key uuid primary key,
  branch_id uuid not null,
  shift_id uuid not null,
  actual_cash numeric(14,2) not null,
  note text,
  requested_by uuid not null,
  processed_at timestamptz not null default now()
);

revoke all on table app_private.shift_close_command_log from public, anon, authenticated;

create index if not exists idx_shift_close_command_log_shift on app_private.shift_close_command_log(shift_id, branch_id);

create or replace function app_private.close_shift_idempotent_internal(
  p_shift_id uuid,
  p_branch_id uuid,
  p_actual_cash numeric,
  p_note text,
  p_idempotency_key uuid
)
returns public.shifts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_status text;
  v_opening numeric;
  v_expected numeric;
  v_result public.shifts;
  v_logged app_private.shift_close_command_log;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_actual_cash < 0 then raise exception 'actual cash cannot be negative'; end if;
  if p_idempotency_key is null then raise exception 'idempotency key is required'; end if;

  select * into v_logged
  from app_private.shift_close_command_log
  where idempotency_key = p_idempotency_key;

  if found then
    if v_logged.shift_id <> p_shift_id
      or v_logged.branch_id <> p_branch_id
      or v_logged.actual_cash <> p_actual_cash
      or coalesce(v_logged.note, '') <> coalesce(nullif(trim(p_note), ''), '') then
      raise exception 'idempotency key payload mismatch';
    end if;

    select * into v_result from public.shifts where id = p_shift_id and branch_id = p_branch_id;
    if not found then raise exception 'shift not found'; end if;
    return v_result;
  end if;

  select user_id, status, opening_balance
  into v_owner, v_status, v_opening
  from public.shifts
  where id = p_shift_id and branch_id = p_branch_id
  for update;

  if not found then raise exception 'shift not found'; end if;
  if v_status <> 'open' then raise exception 'shift already closed by another command'; end if;

  if v_owner = v_user then
    if not app_private.current_user_has_permission('shifts.close', p_branch_id)
      and not app_private.current_user_has_permission('shifts.manage', p_branch_id) then
      raise exception 'permission denied';
    end if;
  elsif not app_private.current_user_has_permission('shifts.manage', p_branch_id) then
    raise exception 'cannot close another user shift';
  end if;

  select v_opening + coalesce(sum(case when movement_type = 'cash_in' then amount else -amount end), 0)
  into v_expected
  from public.cash_drawer_movements
  where shift_id = p_shift_id and branch_id = p_branch_id;

  update public.shifts
  set status = 'closed',
      expected_cash = v_expected,
      actual_cash = p_actual_cash,
      cash_difference = p_actual_cash - v_expected,
      closed_at = now(),
      closed_by = v_user,
      close_note = nullif(trim(p_note), '')
  where id = p_shift_id and branch_id = p_branch_id
  returning * into v_result;

  insert into app_private.shift_close_command_log(idempotency_key, branch_id, shift_id, actual_cash, note, requested_by)
  values (p_idempotency_key, p_branch_id, p_shift_id, p_actual_cash, nullif(trim(p_note), ''), v_user);

  return v_result;
end;
$$;

revoke all on function app_private.close_shift_idempotent_internal(uuid,uuid,numeric,text,uuid) from public, anon;
grant execute on function app_private.close_shift_idempotent_internal(uuid,uuid,numeric,text,uuid) to authenticated;

create or replace function public.close_shift_idempotent(
  p_shift_id uuid,
  p_branch_id uuid,
  p_actual_cash numeric,
  p_note text,
  p_idempotency_key uuid
)
returns public.shifts
language sql
security invoker
set search_path = ''
as $$
  select * from app_private.close_shift_idempotent_internal(p_shift_id,p_branch_id,p_actual_cash,p_note,p_idempotency_key);
$$;

revoke all on function public.close_shift_idempotent(uuid,uuid,numeric,text,uuid) from public, anon;
grant execute on function public.close_shift_idempotent(uuid,uuid,numeric,text,uuid) to authenticated;
