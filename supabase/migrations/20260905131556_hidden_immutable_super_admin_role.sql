alter table public.roles add column if not exists is_hidden boolean not null default false;
alter table public.roles add column if not exists is_immutable boolean not null default false;
alter table public.roles alter column branch_id drop not null;

alter table public.roles add constraint roles_system_scope_check check (
  (is_system = true and is_hidden = true and is_immutable = true and branch_id is null)
  or
  (branch_id is not null)
);

create unique index if not exists ux_roles_global_system_code
  on public.roles(code)
  where branch_id is null;

insert into public.roles(branch_id, code, name_ar, name_en, is_system, is_hidden, is_immutable)
values (null, 'super_admin', 'سوبر أدمن', 'Super Admin', true, true, true)
on conflict do nothing;

insert into public.role_permissions(role_id, permission_key)
select r.id, p.key
from public.roles r
cross join public.permissions p
where r.code = 'super_admin'
  and r.branch_id is null
on conflict do nothing;

create table if not exists app_private.platform_role_assignments (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

revoke all on table app_private.platform_role_assignments from public, anon, authenticated;

create or replace function app_private.user_may_access_branch(p_branch_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from app_private.platform_role_assignments pra
    join public.roles r on r.id = pra.role_id
    where pra.user_id = p_user_id
      and r.code = 'super_admin'
      and r.branch_id is null
      and r.is_system
      and r.is_hidden
      and r.is_immutable
  )
  or exists (
    select 1
    from public.user_branch_access uba
    join public.profiles p on p.id = uba.user_id and p.is_active
    where uba.user_id = p_user_id
      and uba.branch_id = p_branch_id
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
        from app_private.platform_role_assignments pra
        join public.role_permissions rp on rp.role_id = pra.role_id
        where pra.user_id = p_user_id
          and rp.permission_key = p_permission_key
      )
      or exists (
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

create or replace function app_private.current_user_has_permission(p_permission_key text, p_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app_private.has_permission(p_permission_key, p_branch_id, auth.uid());
$$;

alter policy roles_select_accessible on public.roles
using (
  is_hidden = false
  and branch_id is not null
  and app_private.current_user_may_access_branch(branch_id)
);

alter policy role_permissions_select_accessible on public.role_permissions
using (exists (
  select 1
  from public.roles r
  where r.id = role_permissions.role_id
    and r.is_hidden = false
    and r.branch_id is not null
    and app_private.current_user_may_access_branch(r.branch_id)
));

create or replace function app_private.protect_immutable_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_immutable then
    raise exception 'immutable system role cannot be changed';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_protect_immutable_role on public.roles;
create trigger trg_protect_immutable_role
before update or delete on public.roles
for each row execute function app_private.protect_immutable_role();

create or replace function app_private.protect_immutable_role_permissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.roles r
    where r.id = coalesce(old.role_id, new.role_id)
      and r.is_immutable
  ) then
    raise exception 'immutable system role permissions cannot be changed directly';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_protect_immutable_role_permissions on public.role_permissions;
create trigger trg_protect_immutable_role_permissions
before update or delete on public.role_permissions
for each row execute function app_private.protect_immutable_role_permissions();

create or replace function app_private.sync_super_admin_permission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.role_permissions(role_id, permission_key)
  select r.id, new.key
  from public.roles r
  where r.code = 'super_admin'
    and r.branch_id is null
    and r.is_immutable
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists trg_sync_super_admin_permission on public.permissions;
create trigger trg_sync_super_admin_permission
after insert on public.permissions
for each row execute function app_private.sync_super_admin_permission();
