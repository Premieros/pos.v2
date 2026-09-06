create extension if not exists pgcrypto;

create schema if not exists app_private;
revoke all on schema app_private from public;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  is_super_admin boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_ar text not null,
  name_en text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.permissions (
  key text primary key,
  module text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references public.branches(id) on delete cascade,
  code text not null,
  name_ar text not null,
  name_en text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, code)
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_key)
);

create table public.user_branch_access (
  user_id uuid not null references public.profiles(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, branch_id)
);

create table public.user_role_assignments (
  user_id uuid not null references public.profiles(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, branch_id, role_id)
);

create index idx_role_permissions_permission on public.role_permissions(permission_key);
create index idx_user_branch_access_branch on public.user_branch_access(branch_id, user_id);
create index idx_user_role_assignments_branch_user on public.user_role_assignments(branch_id, user_id);

create or replace function app_private.is_super_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select p.is_super_admin and p.is_active
    from public.profiles p
    where p.id = p_user_id
  ), false);
$$;

create or replace function app_private.user_may_access_branch(p_branch_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select app_private.is_super_admin(p_user_id)
      or exists (
        select 1
        from public.user_branch_access uba
        join public.profiles p on p.id = uba.user_id and p.is_active
        where uba.user_id = p_user_id
          and uba.branch_id = p_branch_id
      );
$$;

create or replace function app_private.has_permission(p_permission_key text, p_branch_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select app_private.is_super_admin(p_user_id)
      or (
        app_private.user_may_access_branch(p_branch_id, p_user_id)
        and exists (
          select 1
          from public.user_role_assignments ura
          join public.role_permissions rp on rp.role_id = ura.role_id
          where ura.user_id = p_user_id
            and ura.branch_id = p_branch_id
            and rp.permission_key = p_permission_key
        )
      );
$$;

revoke all on function app_private.is_super_admin(uuid) from public;
revoke all on function app_private.user_may_access_branch(uuid, uuid) from public;
revoke all on function app_private.has_permission(text, uuid, uuid) from public;
grant usage on schema app_private to authenticated;
grant execute on function app_private.is_super_admin(uuid) to authenticated;
grant execute on function app_private.user_may_access_branch(uuid, uuid) to authenticated;
grant execute on function app_private.has_permission(text, uuid, uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.branches enable row level security;
alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_branch_access enable row level security;
alter table public.user_role_assignments enable row level security;

create policy profiles_select_self on public.profiles
for select to authenticated
using (id = (select auth.uid()) or app_private.is_super_admin());

create policy branches_select_accessible on public.branches
for select to authenticated
using (app_private.user_may_access_branch(id));

create policy permissions_select_authenticated on public.permissions
for select to authenticated
using (true);

create policy roles_select_accessible on public.roles
for select to authenticated
using (branch_id is null or app_private.user_may_access_branch(branch_id));

create policy role_permissions_select_accessible on public.role_permissions
for select to authenticated
using (exists (
  select 1 from public.roles r
  where r.id = role_permissions.role_id
    and (r.branch_id is null or app_private.user_may_access_branch(r.branch_id))
));

create policy user_branch_access_select_self on public.user_branch_access
for select to authenticated
using (user_id = (select auth.uid()) or app_private.is_super_admin());

create policy user_role_assignments_select_self on public.user_role_assignments
for select to authenticated
using (user_id = (select auth.uid()) or app_private.is_super_admin());

insert into public.permissions(key, module, description) values
('branches.view','branches','View accessible branches'),
('branches.manage','branches','Create and manage branches'),
('users.view','users','View users in authorized scope'),
('users.manage','users','Create and manage users in authorized scope'),
('roles.view','roles','View roles and permission templates'),
('roles.manage','roles','Manage roles without privilege escalation'),
('catalog.view','catalog','View categories and products'),
('catalog.manage','catalog','Manage categories and products'),
('inventory.view','inventory','View inventory'),
('inventory.manage','inventory','Manage inventory operations'),
('pos.view','pos','Open POS'),
('pos.order.create','pos','Create POS orders'),
('pos.order.edit','pos','Edit POS orders'),
('pos.send_kitchen','pos','Send order delta to kitchen'),
('pos.payment.take','pos','Take payment'),
('pos.order.split','pos','Split orders'),
('pos.order.transfer','pos','Transfer orders/tables'),
('pos.order.cancel','pos','Cancel orders'),
('pos.discount.apply','pos','Apply discounts'),
('pos.receipt.print','pos','Print receipt'),
('pos.receipt.reprint','pos','Reprint receipt'),
('kitchen.view','kitchen','View KDS'),
('kitchen.manage','kitchen','Update kitchen ticket states'),
('shifts.open','shifts','Open own shift'),
('shifts.close','shifts','Close own shift'),
('shifts.manage','shifts','Manage shifts in authorized scope'),
('reports.view','reports','View reports in authorized scope'),
('settings.manage','settings','Manage system settings')
on conflict do nothing;

grant select on public.profiles, public.branches, public.permissions, public.roles, public.role_permissions, public.user_branch_access, public.user_role_assignments to authenticated;
