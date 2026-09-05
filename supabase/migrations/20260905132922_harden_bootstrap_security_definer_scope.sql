create or replace function app_private.bootstrap_first_super_admin_internal(
  p_branch_code text,
  p_branch_name_ar text,
  p_branch_name_en text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_branch_id uuid;
  v_super_admin_role_id uuid;
  v_auth_user_count bigint;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('pos.v2.bootstrap_first_super_admin', 0));

  if exists (select 1 from app_private.platform_role_assignments) then
    raise exception 'system already bootstrapped';
  end if;

  select count(*) into v_auth_user_count from auth.users;
  if v_auth_user_count <> 1 then
    raise exception 'bootstrap requires exactly one auth user';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_user_id and p.is_active
  ) then
    raise exception 'active profile required';
  end if;

  select r.id into v_super_admin_role_id
  from public.roles r
  where r.code = 'super_admin'
    and r.branch_id is null
    and r.is_system
    and r.is_hidden
    and r.is_immutable;

  if v_super_admin_role_id is null then
    raise exception 'super admin system role missing';
  end if;

  insert into public.branches(code, name_ar, name_en)
  values (lower(trim(p_branch_code)), trim(p_branch_name_ar), nullif(trim(p_branch_name_en), ''))
  returning id into v_branch_id;

  insert into public.user_branch_access(user_id, branch_id)
  values (v_user_id, v_branch_id);

  insert into app_private.platform_role_assignments(user_id, role_id)
  values (v_user_id, v_super_admin_role_id);

  return v_branch_id;
end;
$$;

revoke all on function app_private.bootstrap_first_super_admin_internal(text,text,text) from public, anon;
grant execute on function app_private.bootstrap_first_super_admin_internal(text,text,text) to authenticated;

drop function public.bootstrap_first_super_admin(text,text,text);

create function public.bootstrap_first_super_admin(
  p_branch_code text,
  p_branch_name_ar text,
  p_branch_name_en text default null
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select app_private.bootstrap_first_super_admin_internal(
    p_branch_code,
    p_branch_name_ar,
    p_branch_name_en
  );
$$;

revoke all on function public.bootstrap_first_super_admin(text,text,text) from public, anon;
grant execute on function public.bootstrap_first_super_admin(text,text,text) to authenticated;
