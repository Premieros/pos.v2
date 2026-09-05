create or replace function app_private.get_initial_setup_state_internal()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'branch_count', (select count(*) from public.branches),
    'platform_assignment_count', (select count(*) from app_private.platform_role_assignments),
    'bootstrap_available',
      (select count(*) = 0 from public.branches)
      and (select count(*) = 0 from app_private.platform_role_assignments)
      and auth.uid() is not null
  );
$$;

revoke all on function app_private.get_initial_setup_state_internal() from public, anon;
grant execute on function app_private.get_initial_setup_state_internal() to authenticated;

create or replace function public.get_initial_setup_state()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select app_private.get_initial_setup_state_internal();
$$;

revoke all on function public.get_initial_setup_state() from public, anon;
grant execute on function public.get_initial_setup_state() to authenticated;
