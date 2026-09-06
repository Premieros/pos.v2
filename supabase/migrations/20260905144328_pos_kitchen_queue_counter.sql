create or replace function app_private.count_kitchen_queue_internal(p_branch_id uuid)
returns integer
language plpgsql
security definer
set search_path=''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if not (
    app_private.current_user_has_permission('pos.view', p_branch_id)
    or app_private.current_user_has_permission('kitchen.view', p_branch_id)
    or app_private.current_user_has_permission('kitchen.manage', p_branch_id)
  ) then
    raise exception 'permission denied';
  end if;

  return (
    select count(*)::integer
    from public.kitchen_tickets
    where branch_id = p_branch_id
      and status in ('queued','preparing','ready')
  );
end;
$$;

revoke all on function app_private.count_kitchen_queue_internal(uuid) from public, anon;
grant execute on function app_private.count_kitchen_queue_internal(uuid) to authenticated;

create or replace function public.count_kitchen_queue(p_branch_id uuid)
returns integer
language sql
security invoker
set search_path=''
as $$
  select app_private.count_kitchen_queue_internal(p_branch_id);
$$;

revoke all on function public.count_kitchen_queue(uuid) from public, anon;
grant execute on function public.count_kitchen_queue(uuid) to authenticated;
