create or replace function app_private.current_user_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select app_private.is_super_admin(auth.uid());
$$;

create or replace function app_private.current_user_may_access_branch(p_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select app_private.user_may_access_branch(p_branch_id, auth.uid());
$$;

create or replace function app_private.current_user_has_permission(p_permission_key text, p_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select app_private.has_permission(p_permission_key, p_branch_id, auth.uid());
$$;

revoke all on function app_private.is_super_admin(uuid) from authenticated;
revoke all on function app_private.user_may_access_branch(uuid, uuid) from authenticated;
revoke all on function app_private.has_permission(text, uuid, uuid) from authenticated;

revoke all on function app_private.current_user_is_super_admin() from public;
revoke all on function app_private.current_user_may_access_branch(uuid) from public;
revoke all on function app_private.current_user_has_permission(text, uuid) from public;
grant execute on function app_private.current_user_is_super_admin() to authenticated;
grant execute on function app_private.current_user_may_access_branch(uuid) to authenticated;
grant execute on function app_private.current_user_has_permission(text, uuid) to authenticated;

alter policy profiles_select_self on public.profiles
using (id = (select auth.uid()) or app_private.current_user_is_super_admin());

alter policy branches_select_accessible on public.branches
using (app_private.current_user_may_access_branch(id));

alter policy roles_select_accessible on public.roles
using (app_private.current_user_may_access_branch(branch_id));

alter policy role_permissions_select_accessible on public.role_permissions
using (exists (
  select 1 from public.roles r
  where r.id = role_permissions.role_id
    and app_private.current_user_may_access_branch(r.branch_id)
));

alter policy user_branch_access_select_self on public.user_branch_access
using (user_id = (select auth.uid()) or app_private.current_user_is_super_admin());

alter policy user_role_assignments_select_self on public.user_role_assignments
using (user_id = (select auth.uid()) or app_private.current_user_is_super_admin());

alter table public.roles alter column branch_id set not null;
alter table public.roles add constraint roles_id_branch_unique unique (id, branch_id);
alter table public.user_role_assignments drop constraint user_role_assignments_role_id_fkey;
alter table public.user_role_assignments
  add constraint user_role_assignments_role_branch_fkey
  foreign key (role_id, branch_id)
  references public.roles(id, branch_id)
  on delete cascade;
