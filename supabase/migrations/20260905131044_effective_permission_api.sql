create or replace function public.current_user_can(p_permission_key text, p_branch_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select app_private.current_user_has_permission(p_permission_key, p_branch_id);
$$;

create or replace function public.current_user_effective_permissions(p_branch_id uuid)
returns table(permission_key text)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.key
  from public.permissions p
  where app_private.current_user_has_permission(p.key, p_branch_id)
  order by p.key;
$$;

revoke all on function public.current_user_can(text, uuid) from public, anon;
revoke all on function public.current_user_effective_permissions(uuid) from public, anon;
grant execute on function public.current_user_can(text, uuid) to authenticated;
grant execute on function public.current_user_effective_permissions(uuid) to authenticated;
