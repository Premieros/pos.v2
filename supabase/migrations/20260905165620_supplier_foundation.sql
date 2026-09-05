insert into public.permissions(key,module,description) values
 ('procurement.view','procurement','View procurement data in accessible branches'),
 ('procurement.suppliers.manage','procurement','Create and manage suppliers in accessible branches')
on conflict (key) do nothing;

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  code text not null check (length(trim(code)) >= 1),
  name_ar text not null check (length(trim(name_ar)) >= 2),
  name_en text null,
  phone text null,
  email text null,
  tax_number text null,
  notes text null,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(branch_id,code)
);

create unique index idx_suppliers_branch_tax_number on public.suppliers(branch_id,tax_number) where tax_number is not null and length(trim(tax_number))>0;
create index idx_suppliers_branch_active_name on public.suppliers(branch_id,is_active,name_ar);
create index idx_suppliers_created_by on public.suppliers(created_by);
create index idx_suppliers_updated_by on public.suppliers(updated_by);

alter table public.suppliers enable row level security;
revoke all on public.suppliers from anon,authenticated;
grant select on public.suppliers to authenticated;

create policy suppliers_select on public.suppliers for select to authenticated using (
  app_private.current_user_may_access_branch(branch_id)
  and (
    app_private.current_user_has_permission('procurement.view',branch_id)
    or app_private.current_user_has_permission('procurement.suppliers.manage',branch_id)
  )
);

create or replace function app_private.create_supplier_internal(p_branch_id uuid,p_code text,p_name_ar text,p_name_en text,p_phone text,p_email text,p_tax_number text,p_notes text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user_id uuid := auth.uid(); v_id uuid; v_code text := upper(nullif(trim(p_code),'')); v_name_ar text := nullif(trim(p_name_ar),'');
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if not app_private.current_user_has_permission('procurement.suppliers.manage',p_branch_id) then raise exception 'permission denied'; end if;
  if v_code is null then raise exception 'supplier code required'; end if;
  if v_name_ar is null or length(v_name_ar)<2 then raise exception 'supplier name required'; end if;
  insert into public.suppliers(branch_id,code,name_ar,name_en,phone,email,tax_number,notes,created_by,updated_by)
  values(p_branch_id,v_code,v_name_ar,nullif(trim(p_name_en),''),nullif(trim(p_phone),''),nullif(trim(p_email),''),nullif(trim(p_tax_number),''),nullif(trim(p_notes),''),v_user_id,v_user_id)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.create_supplier(p_branch_id uuid,p_code text,p_name_ar text,p_name_en text default null,p_phone text default null,p_email text default null,p_tax_number text default null,p_notes text default null)
returns uuid language sql security invoker set search_path=''
as $$ select app_private.create_supplier_internal(p_branch_id,p_code,p_name_ar,p_name_en,p_phone,p_email,p_tax_number,p_notes); $$;

grant execute on function public.create_supplier(uuid,text,text,text,text,text,text,text) to authenticated;
revoke execute on function app_private.create_supplier_internal(uuid,text,text,text,text,text,text,text) from public,anon,authenticated;

create or replace function app_private.update_supplier_internal(p_supplier_id uuid,p_code text,p_name_ar text,p_name_en text,p_phone text,p_email text,p_tax_number text,p_notes text,p_is_active boolean)
returns void language plpgsql security definer set search_path=''
as $$
declare v_user_id uuid := auth.uid(); v_branch_id uuid; v_code text := upper(nullif(trim(p_code),'')); v_name_ar text := nullif(trim(p_name_ar),'');
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  select branch_id into v_branch_id from public.suppliers where id=p_supplier_id for update;
  if v_branch_id is null then raise exception 'supplier not found'; end if;
  if not app_private.current_user_has_permission('procurement.suppliers.manage',v_branch_id) then raise exception 'permission denied'; end if;
  if v_code is null then raise exception 'supplier code required'; end if;
  if v_name_ar is null or length(v_name_ar)<2 then raise exception 'supplier name required'; end if;
  update public.suppliers set code=v_code,name_ar=v_name_ar,name_en=nullif(trim(p_name_en),''),phone=nullif(trim(p_phone),''),email=nullif(trim(p_email),''),tax_number=nullif(trim(p_tax_number),''),notes=nullif(trim(p_notes),''),is_active=coalesce(p_is_active,is_active),updated_by=v_user_id,updated_at=now() where id=p_supplier_id;
end $$;

create or replace function public.update_supplier(p_supplier_id uuid,p_code text,p_name_ar text,p_name_en text default null,p_phone text default null,p_email text default null,p_tax_number text default null,p_notes text default null,p_is_active boolean default true)
returns void language sql security invoker set search_path=''
as $$ select app_private.update_supplier_internal(p_supplier_id,p_code,p_name_ar,p_name_en,p_phone,p_email,p_tax_number,p_notes,p_is_active); $$;

grant execute on function public.update_supplier(uuid,text,text,text,text,text,text,text,boolean) to authenticated;
revoke execute on function app_private.update_supplier_internal(uuid,text,text,text,text,text,text,text,boolean) from public,anon,authenticated;
