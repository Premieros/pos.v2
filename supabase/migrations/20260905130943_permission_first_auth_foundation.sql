create table public.user_permissions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  effect text not null default 'grant' check (effect in ('grant','revoke')),
  created_at timestamptz not null default now(),
  primary key (user_id, branch_id, permission_key)
);

create index idx_user_permissions_branch_user on public.user_permissions(branch_id, user_id);
create index idx_user_permissions_permission on public.user_permissions(permission_key);

alter table public.user_permissions enable row level security;

grant select on public.user_permissions to authenticated;

create or replace function app_private.user_may_access_branch(p_branch_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_branch_access uba
    join public.profiles p on p.id = uba.user_id
    where uba.user_id = p_user_id
      and uba.branch_id = p_branch_id
      and p.is_active = true
  );
$$;

create or replace function app_private.has_permission(p_permission_key text, p_branch_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app_private.user_may_access_branch(p_branch_id, p_user_id)
    and not exists (
      select 1
      from public.user_permissions up
      where up.user_id = p_user_id
        and up.branch_id = p_branch_id
        and up.permission_key = p_permission_key
        and up.effect = 'revoke'
    )
    and (
      exists (
        select 1
        from public.user_permissions up
        where up.user_id = p_user_id
          and up.branch_id = p_branch_id
          and up.permission_key = p_permission_key
          and up.effect = 'grant'
      )
      or exists (
        select 1
        from public.user_role_assignments ura
        join public.role_permissions rp on rp.role_id = ura.role_id
        where ura.user_id = p_user_id
          and ura.branch_id = p_branch_id
          and rp.permission_key = p_permission_key
      )
    );
$$;

create or replace function app_private.current_user_may_access_branch(p_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app_private.user_may_access_branch(p_branch_id, auth.uid());
$$;

create or replace function app_private.current_user_has_permission(p_permission_key text, p_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app_private.has_permission(p_permission_key, p_branch_id, auth.uid());
$$;

revoke all on function app_private.user_may_access_branch(uuid, uuid) from public, anon, authenticated;
revoke all on function app_private.has_permission(text, uuid, uuid) from public, anon, authenticated;
revoke all on function app_private.current_user_may_access_branch(uuid) from public, anon;
revoke all on function app_private.current_user_has_permission(text, uuid) from public, anon;
grant usage on schema app_private to authenticated;
grant execute on function app_private.current_user_may_access_branch(uuid) to authenticated;
grant execute on function app_private.current_user_has_permission(text, uuid) to authenticated;

drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
for select to authenticated
using (id = (select auth.uid()));

drop policy if exists user_branch_access_select_self on public.user_branch_access;
create policy user_branch_access_select_self on public.user_branch_access
for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists user_role_assignments_select_self on public.user_role_assignments;
create policy user_role_assignments_select_self on public.user_role_assignments
for select to authenticated
using (user_id = (select auth.uid()));

create policy user_permissions_select_self on public.user_permissions
for select to authenticated
using (user_id = (select auth.uid()));

create or replace function app_private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(id, display_name, is_super_admin, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, ''), '@', 1), ''),
    false,
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function app_private.handle_new_auth_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row execute function app_private.handle_new_auth_user();

insert into public.permissions(key, module, description) values
('branches.create','branches','Create branches when platform policy allows it'),
('branches.update','branches','Update accessible branch settings'),
('users.create','users','Create users in authorized scope'),
('users.update','users','Update users in authorized scope'),
('users.deactivate','users','Deactivate users in authorized scope'),
('users.permissions.manage','users','Grant or revoke user permissions without role dependency'),
('roles.assign','roles','Assign role templates in authorized scope')
on conflict do nothing;

comment on table public.roles is 'Optional permission templates only. Role names must never be used for authorization decisions.';
comment on table public.user_permissions is 'Direct per-user permission grants/revokes. Explicit revoke overrides both direct grants and role-template grants.';
comment on column public.profiles.is_super_admin is 'Deprecated compatibility column. It is not consulted by authorization helpers.';
