create or replace function app_private.get_branch_administration_snapshot_internal(p_branch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_can_users boolean;
  v_can_roles boolean;
  v_can_permissions boolean;
  v_can_inventory boolean;
  v_can_branches boolean;
  v_is_platform_super boolean;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'authentication required'; end if;
  if not app_private.current_user_may_access_branch(p_branch_id) then raise exception 'branch access denied'; end if;

  v_can_users := app_private.current_user_has_permission('users.view', p_branch_id)
    or app_private.current_user_has_permission('users.manage', p_branch_id)
    or app_private.current_user_has_permission('users.permissions.manage', p_branch_id);
  v_can_roles := app_private.current_user_has_permission('roles.view', p_branch_id)
    or app_private.current_user_has_permission('roles.manage', p_branch_id)
    or app_private.current_user_has_permission('roles.assign', p_branch_id);
  v_can_permissions := app_private.current_user_has_permission('users.permissions.manage', p_branch_id);
  v_can_inventory := app_private.current_user_has_permission('inventory.view', p_branch_id)
    or app_private.current_user_has_permission('inventory.setup', p_branch_id);
  v_can_branches := app_private.current_user_has_permission('branches.view', p_branch_id)
    or app_private.current_user_has_permission('branches.manage', p_branch_id)
    or app_private.current_user_has_permission('branches.update', p_branch_id);
  v_is_platform_super := app_private.is_platform_super_admin(v_uid);

  if not (v_can_users or v_can_roles or v_can_inventory or v_can_branches or app_private.current_user_has_permission('settings.manage', p_branch_id)) then
    raise exception 'administration access denied';
  end if;

  select jsonb_build_object(
    'branch', (select jsonb_build_object('id', b.id, 'code', b.code, 'name_ar', b.name_ar, 'name_en', b.name_en, 'is_active', b.is_active) from public.branches b where b.id = p_branch_id),
    'can_create_branch', v_is_platform_super,
    'users', case when v_can_users then coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'display_name', p.display_name, 'is_active', p.is_active) order by p.display_name, p.id) from public.user_branch_access uba join public.profiles p on p.id = uba.user_id where uba.branch_id = p_branch_id and not app_private.is_platform_super_admin(p.id)), '[]'::jsonb) else '[]'::jsonb end,
    'roles', case when v_can_roles then coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'code', r.code, 'name_ar', r.name_ar, 'name_en', r.name_en, 'is_system', r.is_system) order by r.name_ar, r.id) from public.roles r where r.branch_id = p_branch_id and r.is_hidden = false and r.is_immutable = false), '[]'::jsonb) else '[]'::jsonb end,
    'role_permissions', case when v_can_roles then coalesce((select jsonb_agg(jsonb_build_object('role_id', rp.role_id, 'permission_key', rp.permission_key) order by rp.role_id, rp.permission_key) from public.role_permissions rp join public.roles r on r.id = rp.role_id where r.branch_id = p_branch_id and r.is_hidden = false and r.is_immutable = false), '[]'::jsonb) else '[]'::jsonb end,
    'user_role_assignments', case when v_can_users and v_can_roles then coalesce((select jsonb_agg(jsonb_build_object('user_id', ura.user_id, 'role_id', ura.role_id) order by ura.user_id, ura.role_id) from public.user_role_assignments ura join public.roles r on r.id = ura.role_id where ura.branch_id = p_branch_id and r.branch_id = p_branch_id and r.is_hidden = false and r.is_immutable = false and not app_private.is_platform_super_admin(ura.user_id)), '[]'::jsonb) else '[]'::jsonb end,
    'user_permissions', case when v_can_permissions then coalesce((select jsonb_agg(jsonb_build_object('user_id', up.user_id, 'permission_key', up.permission_key, 'effect', up.effect) order by up.user_id, up.permission_key) from public.user_permissions up where up.branch_id = p_branch_id and not app_private.is_platform_super_admin(up.user_id)), '[]'::jsonb) else '[]'::jsonb end,
    'permissions', case when v_can_roles or v_can_permissions then coalesce((select jsonb_agg(jsonb_build_object('key', p.key, 'module', p.module, 'description', p.description) order by p.module, p.key) from public.permissions p), '[]'::jsonb) else '[]'::jsonb end,
    'warehouses', case when v_can_inventory then coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'code', w.code, 'name_ar', w.name_ar, 'name_en', w.name_en, 'is_active', w.is_active) order by w.name_ar, w.id) from public.warehouses w where w.branch_id = p_branch_id), '[]'::jsonb) else '[]'::jsonb end,
    'platform_users', case when v_is_platform_super then coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'display_name', p.display_name, 'is_active', p.is_active, 'has_branch_access', exists(select 1 from public.user_branch_access uba where uba.user_id = p.id and uba.branch_id = p_branch_id)) order by p.display_name, p.id) from public.profiles p where not app_private.is_platform_super_admin(p.id)), '[]'::jsonb) else '[]'::jsonb end
  ) into v_result;
  return v_result;
end;
$$;

create or replace function app_private.create_branch_admin_internal(p_code text, p_name_ar text, p_name_en text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_code text := upper(trim(p_code)); v_name_ar text := trim(p_name_ar);
begin
  if auth.uid() is null or not app_private.is_platform_super_admin(auth.uid()) then raise exception 'only platform super admin may create branches'; end if;
  if v_code = '' or v_name_ar = '' then raise exception 'branch code and Arabic name are required'; end if;
  insert into public.branches(code,name_ar,name_en) values(v_code,v_name_ar,nullif(trim(p_name_en),'')) returning id into v_id;
  return v_id;
end; $$;

create or replace function app_private.update_branch_admin_internal(p_branch_id uuid,p_name_ar text,p_name_en text,p_is_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not app_private.current_user_may_access_branch(p_branch_id) then raise exception 'branch access denied'; end if;
  if not (app_private.current_user_has_permission('branches.update',p_branch_id) or app_private.current_user_has_permission('branches.manage',p_branch_id)) then raise exception 'missing branches.update'; end if;
  if trim(p_name_ar) = '' then raise exception 'Arabic branch name is required'; end if;
  update public.branches set name_ar=trim(p_name_ar),name_en=nullif(trim(p_name_en),''),is_active=p_is_active,updated_at=now() where id=p_branch_id;
end; $$;

create or replace function app_private.create_role_template_internal(p_branch_id uuid,p_code text,p_name_ar text,p_name_en text,p_permission_keys text[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_role_id uuid; v_key text; v_code text := lower(trim(p_code));
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not app_private.current_user_may_access_branch(p_branch_id) then raise exception 'branch access denied'; end if;
  if not app_private.current_user_has_permission('roles.manage',p_branch_id) then raise exception 'missing roles.manage'; end if;
  if v_code='' or v_code='super_admin' or trim(p_name_ar)='' then raise exception 'invalid role template'; end if;
  foreach v_key in array coalesce(p_permission_keys,array[]::text[]) loop
    if not exists(select 1 from public.permissions p where p.key=v_key) then raise exception 'unknown permission: %',v_key; end if;
    if not app_private.current_user_has_permission(v_key,p_branch_id) then raise exception 'cannot place permission not held by current user in role: %',v_key; end if;
  end loop;
  insert into public.roles(branch_id,code,name_ar,name_en,is_system,is_hidden,is_immutable) values(p_branch_id,v_code,trim(p_name_ar),nullif(trim(p_name_en),''),false,false,false) returning id into v_role_id;
  insert into public.role_permissions(role_id,permission_key) select v_role_id,key from unnest(coalesce(p_permission_keys,array[]::text[])) as key on conflict do nothing;
  return v_role_id;
end; $$;

create or replace function app_private.update_role_template_internal(p_role_id uuid,p_branch_id uuid,p_name_ar text,p_name_en text,p_permission_keys text[])
returns void language plpgsql security definer set search_path = '' as $$
declare v_key text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not app_private.current_user_may_access_branch(p_branch_id) then raise exception 'branch access denied'; end if;
  if not app_private.current_user_has_permission('roles.manage',p_branch_id) then raise exception 'missing roles.manage'; end if;
  if not exists(select 1 from public.roles r where r.id=p_role_id and r.branch_id=p_branch_id and not r.is_hidden and not r.is_immutable and not r.is_system) then raise exception 'role template is not editable'; end if;
  if trim(p_name_ar)='' then raise exception 'Arabic role name is required'; end if;
  foreach v_key in array coalesce(p_permission_keys,array[]::text[]) loop
    if not exists(select 1 from public.permissions p where p.key=v_key) then raise exception 'unknown permission: %',v_key; end if;
    if not app_private.current_user_has_permission(v_key,p_branch_id) then raise exception 'cannot place permission not held by current user in role: %',v_key; end if;
  end loop;
  update public.roles set name_ar=trim(p_name_ar),name_en=nullif(trim(p_name_en),''),updated_at=now() where id=p_role_id;
  delete from public.role_permissions where role_id=p_role_id;
  insert into public.role_permissions(role_id,permission_key) select p_role_id,key from unnest(coalesce(p_permission_keys,array[]::text[])) as key on conflict do nothing;
end; $$;

create or replace function app_private.grant_user_branch_access_admin_internal(p_user_id uuid,p_branch_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  perform app_private.assert_not_protected_platform_user(p_user_id);
  if not app_private.current_user_may_access_branch(p_branch_id) then raise exception 'branch access denied'; end if;
  if not app_private.current_user_has_permission('users.manage',p_branch_id) then raise exception 'missing users.manage'; end if;
  if not exists(select 1 from public.profiles p where p.id=p_user_id and p.is_active) then raise exception 'target user is unavailable'; end if;
  insert into public.user_branch_access(user_id,branch_id) values(p_user_id,p_branch_id) on conflict do nothing;
end; $$;

create or replace function app_private.revoke_user_branch_access_admin_internal(p_user_id uuid,p_branch_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  perform app_private.assert_not_protected_platform_user(p_user_id);
  if p_user_id=auth.uid() then raise exception 'cannot revoke your own branch access'; end if;
  if not app_private.current_user_may_access_branch(p_branch_id) then raise exception 'branch access denied'; end if;
  if not app_private.current_user_has_permission('users.manage',p_branch_id) then raise exception 'missing users.manage'; end if;
  delete from public.user_permissions where user_id=p_user_id and branch_id=p_branch_id;
  delete from public.user_role_assignments where user_id=p_user_id and branch_id=p_branch_id;
  delete from public.user_branch_access where user_id=p_user_id and branch_id=p_branch_id;
end; $$;

revoke all on function app_private.get_branch_administration_snapshot_internal(uuid) from public,anon;
revoke all on function app_private.create_branch_admin_internal(text,text,text) from public,anon;
revoke all on function app_private.update_branch_admin_internal(uuid,text,text,boolean) from public,anon;
revoke all on function app_private.create_role_template_internal(uuid,text,text,text,text[]) from public,anon;
revoke all on function app_private.update_role_template_internal(uuid,uuid,text,text,text[]) from public,anon;
revoke all on function app_private.grant_user_branch_access_admin_internal(uuid,uuid) from public,anon;
revoke all on function app_private.revoke_user_branch_access_admin_internal(uuid,uuid) from public,anon;
grant execute on function app_private.get_branch_administration_snapshot_internal(uuid) to authenticated;
grant execute on function app_private.create_branch_admin_internal(text,text,text) to authenticated;
grant execute on function app_private.update_branch_admin_internal(uuid,text,text,boolean) to authenticated;
grant execute on function app_private.create_role_template_internal(uuid,text,text,text,text[]) to authenticated;
grant execute on function app_private.update_role_template_internal(uuid,uuid,text,text,text[]) to authenticated;
grant execute on function app_private.grant_user_branch_access_admin_internal(uuid,uuid) to authenticated;
grant execute on function app_private.revoke_user_branch_access_admin_internal(uuid,uuid) to authenticated;

create or replace function public.get_branch_administration_snapshot(p_branch_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$ select app_private.get_branch_administration_snapshot_internal(p_branch_id); $$;
create or replace function public.create_branch_admin(p_code text,p_name_ar text,p_name_en text default null) returns uuid language sql security invoker set search_path='' as $$ select app_private.create_branch_admin_internal(p_code,p_name_ar,p_name_en); $$;
create or replace function public.update_branch_admin(p_branch_id uuid,p_name_ar text,p_name_en text,p_is_active boolean) returns void language sql security invoker set search_path='' as $$ select app_private.update_branch_admin_internal(p_branch_id,p_name_ar,p_name_en,p_is_active); $$;
create or replace function public.create_role_template(p_branch_id uuid,p_code text,p_name_ar text,p_name_en text,p_permission_keys text[]) returns uuid language sql security invoker set search_path='' as $$ select app_private.create_role_template_internal(p_branch_id,p_code,p_name_ar,p_name_en,p_permission_keys); $$;
create or replace function public.update_role_template(p_role_id uuid,p_branch_id uuid,p_name_ar text,p_name_en text,p_permission_keys text[]) returns void language sql security invoker set search_path='' as $$ select app_private.update_role_template_internal(p_role_id,p_branch_id,p_name_ar,p_name_en,p_permission_keys); $$;
create or replace function public.grant_user_branch_access_admin(p_user_id uuid,p_branch_id uuid) returns void language sql security invoker set search_path='' as $$ select app_private.grant_user_branch_access_admin_internal(p_user_id,p_branch_id); $$;
create or replace function public.revoke_user_branch_access_admin(p_user_id uuid,p_branch_id uuid) returns void language sql security invoker set search_path='' as $$ select app_private.revoke_user_branch_access_admin_internal(p_user_id,p_branch_id); $$;
