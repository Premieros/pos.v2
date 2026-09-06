insert into public.permissions(key,module,description)
values ('reports.view','reports','View branch reports')
on conflict (key) do nothing;

create or replace function app_private.assert_report_access(p_branch_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not app_private.current_user_may_access_branch(p_branch_id) then raise exception 'branch access denied'; end if;
  if not app_private.current_user_has_permission('reports.view',p_branch_id) then raise exception 'permission denied'; end if;
end $$;
revoke all on function app_private.assert_report_access(uuid) from public,anon,authenticated;

create or replace function app_private.get_report_filter_options_internal(p_branch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_products jsonb;
  v_employees jsonb;
begin
  perform app_private.assert_report_access(p_branch_id);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,
    'name_ar',p.name_ar,
    'name_en',p.name_en,
    'sku',p.sku,
    'is_active',p.is_active
  ) order by p.name_ar),'[]'::jsonb)
  into v_products
  from public.products p
  where p.branch_id=p_branch_id;

  with employee_ids as (
    select uba.user_id as id from public.user_branch_access uba where uba.branch_id=p_branch_id
    union
    select o.created_by from public.orders o where o.branch_id=p_branch_id
    union
    select p.created_by from public.payments p where p.branch_id=p_branch_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',pr.id,
    'display_name',pr.display_name,
    'is_active',pr.is_active
  ) order by pr.display_name),'[]'::jsonb)
  into v_employees
  from employee_ids e
  join public.profiles pr on pr.id=e.id;

  return jsonb_build_object(
    'products',v_products,
    'employees',v_employees,
    'payment_methods',jsonb_build_array('cash','card'),
    'order_types',jsonb_build_array('dine_in','take_away','drive_thru','delivery','quick')
  );
end $$;
revoke all on function app_private.get_report_filter_options_internal(uuid) from public,anon,authenticated;

create or replace function public.get_report_filter_options(p_branch_id uuid)
returns jsonb
language sql
security invoker
set search_path=''
as $$ select app_private.get_report_filter_options_internal(p_branch_id) $$;
revoke all on function public.get_report_filter_options(uuid) from public,anon;
grant execute on function public.get_report_filter_options(uuid) to authenticated;
