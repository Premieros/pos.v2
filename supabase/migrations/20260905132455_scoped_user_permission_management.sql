create or replace function app_private.assert_can_manage_permission(
  p_branch_id uuid,
  p_permission_key text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app_private.current_user_has_permission('users.permissions.manage', p_branch_id) then
    raise exception 'missing users.permissions.manage';
  end if;

  if not app_private.current_user_has_permission(p_permission_key, p_branch_id) then
    raise exception 'cannot grant or revoke a permission you do not effectively hold';
  end if;
end;
$$;

revoke all on function app_private.assert_can_manage_permission(uuid,text) from public, anon, authenticated;

create or replace function public.set_user_permission(
  p_user_id uuid,
  p_branch_id uuid,
  p_permission_key text,
  p_effect text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_effect not in ('grant','revoke') then
    raise exception 'effect must be grant or revoke';
  end if;

  perform app_private.assert_can_manage_permission(p_branch_id, p_permission_key);

  if not app_private.current_user_may_access_branch(p_branch_id) then
    raise exception 'branch access denied';
  end if;

  if not exists (
    select 1 from public.user_branch_access uba
    where uba.user_id = p_user_id and uba.branch_id = p_branch_id
  ) then
    raise exception 'target user does not have branch access';
  end if;

  insert into public.user_permissions(user_id, branch_id, permission_key, effect)
  values (p_user_id, p_branch_id, p_permission_key, p_effect)
  on conflict (user_id, branch_id, permission_key)
  do update set effect = excluded.effect;
end;
$$;

create or replace function public.clear_user_permission_override(
  p_user_id uuid,
  p_branch_id uuid,
  p_permission_key text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform app_private.assert_can_manage_permission(p_branch_id, p_permission_key);

  delete from public.user_permissions
  where user_id = p_user_id
    and branch_id = p_branch_id
    and permission_key = p_permission_key;
end;
$$;

create or replace function public.assign_user_role(
  p_user_id uuid,
  p_branch_id uuid,
  p_role_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_permission_key text;
begin
  if not app_private.current_user_has_permission('roles.assign', p_branch_id) then
    raise exception 'missing roles.assign';
  end if;

  if not app_private.current_user_may_access_branch(p_branch_id) then
    raise exception 'branch access denied';
  end if;

  if not exists (
    select 1 from public.user_branch_access uba
    where uba.user_id = p_user_id and uba.branch_id = p_branch_id
  ) then
    raise exception 'target user does not have branch access';
  end if;

  if not exists (
    select 1 from public.roles r
    where r.id = p_role_id
      and r.branch_id = p_branch_id
      and r.is_hidden = false
      and r.is_immutable = false
  ) then
    raise exception 'role is not assignable in this branch';
  end if;

  for v_permission_key in
    select rp.permission_key
    from public.role_permissions rp
    where rp.role_id = p_role_id
  loop
    if not app_private.current_user_has_permission(v_permission_key, p_branch_id) then
      raise exception 'role contains permission not held by assigning user: %', v_permission_key;
    end if;
  end loop;

  insert into public.user_role_assignments(user_id, branch_id, role_id)
  values (p_user_id, p_branch_id, p_role_id)
  on conflict do nothing;
end;
$$;

create or replace function public.unassign_user_role(
  p_user_id uuid,
  p_branch_id uuid,
  p_role_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not app_private.current_user_has_permission('roles.assign', p_branch_id) then
    raise exception 'missing roles.assign';
  end if;

  delete from public.user_role_assignments
  where user_id = p_user_id
    and branch_id = p_branch_id
    and role_id = p_role_id;
end;
$$;

create or replace function public.list_branch_users(p_branch_id uuid)
returns table(
  user_id uuid,
  display_name text,
  is_active boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, p.display_name, p.is_active
  from public.profiles p
  join public.user_branch_access uba on uba.user_id = p.id
  where uba.branch_id = p_branch_id
    and app_private.current_user_has_permission('users.view', p_branch_id)
    and app_private.current_user_may_access_branch(p_branch_id)
  order by p.display_name, p.id;
$$;

grant execute on function public.set_user_permission(uuid,uuid,text,text) to authenticated;
grant execute on function public.clear_user_permission_override(uuid,uuid,text) to authenticated;
grant execute on function public.assign_user_role(uuid,uuid,uuid) to authenticated;
grant execute on function public.unassign_user_role(uuid,uuid,uuid) to authenticated;
grant execute on function public.list_branch_users(uuid) to authenticated;
