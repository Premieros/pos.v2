insert into public.permissions(key,module,description) values
  ('customers.view','customers','View branch customers and addresses'),
  ('customers.create','customers','Create branch customers and addresses'),
  ('customers.manage','customers','Manage branch customers and addresses')
on conflict (key) do update set module=excluded.module, description=excluded.description;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  name text not null check (btrim(name) <> ''),
  phone text,
  email text,
  notes text,
  is_active boolean not null default true,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, branch_id)
);

create unique index if not exists customers_branch_phone_unique
  on public.customers(branch_id, lower(phone))
  where phone is not null and btrim(phone) <> '';
create index if not exists customers_branch_name_idx on public.customers(branch_id, name);

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  customer_id uuid not null,
  label text,
  address_line text not null check (btrim(address_line) <> ''),
  area text,
  city text,
  delivery_notes text,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, branch_id),
  constraint customer_addresses_customer_branch_fk foreign key (customer_id, branch_id)
    references public.customers(id, branch_id)
);
create index if not exists customer_addresses_customer_idx on public.customer_addresses(branch_id, customer_id);

alter table public.orders
  add column if not exists customer_id uuid,
  add column if not exists customer_name_snapshot text,
  add column if not exists customer_phone_snapshot text,
  add column if not exists delivery_address_id uuid,
  add column if not exists delivery_address_snapshot text,
  add column if not exists delivery_notes_snapshot text,
  add column if not exists drive_thru_reference text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='orders_customer_branch_fk') then
    alter table public.orders add constraint orders_customer_branch_fk
      foreign key (customer_id, branch_id) references public.customers(id, branch_id);
  end if;
  if not exists (select 1 from pg_constraint where conname='orders_delivery_address_branch_fk') then
    alter table public.orders add constraint orders_delivery_address_branch_fk
      foreign key (delivery_address_id, branch_id) references public.customer_addresses(id, branch_id);
  end if;
end $$;

alter table public.customers enable row level security;
alter table public.customer_addresses enable row level security;

drop policy if exists customers_select on public.customers;
create policy customers_select on public.customers for select to authenticated
using (
  app_private.user_may_access_branch(branch_id, auth.uid())
  and (
    app_private.current_user_has_permission('pos.view', branch_id)
    or app_private.current_user_has_permission('customers.view', branch_id)
    or app_private.current_user_has_permission('customers.create', branch_id)
    or app_private.current_user_has_permission('customers.manage', branch_id)
  )
);

drop policy if exists customer_addresses_select on public.customer_addresses;
create policy customer_addresses_select on public.customer_addresses for select to authenticated
using (
  app_private.user_may_access_branch(branch_id, auth.uid())
  and (
    app_private.current_user_has_permission('pos.view', branch_id)
    or app_private.current_user_has_permission('customers.view', branch_id)
    or app_private.current_user_has_permission('customers.create', branch_id)
    or app_private.current_user_has_permission('customers.manage', branch_id)
  )
);

revoke all on public.customers, public.customer_addresses from authenticated;
grant select on public.customers, public.customer_addresses to authenticated;

create or replace function app_private.create_customer_internal(
  p_branch_id uuid, p_name text, p_phone text default null, p_email text default null, p_notes text default null
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not (
    app_private.current_user_has_permission('customers.create',p_branch_id)
    or app_private.current_user_has_permission('customers.manage',p_branch_id)
  ) then raise exception 'permission denied'; end if;
  if nullif(btrim(p_name),'') is null then raise exception 'customer name required'; end if;
  insert into public.customers(branch_id,name,phone,email,notes,created_by)
  values(p_branch_id,btrim(p_name),nullif(btrim(p_phone),''),nullif(btrim(p_email),''),nullif(btrim(p_notes),''),auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.create_customer(
  p_branch_id uuid, p_name text, p_phone text default null, p_email text default null, p_notes text default null
) returns uuid language sql set search_path=''
as $$ select app_private.create_customer_internal(p_branch_id,p_name,p_phone,p_email,p_notes); $$;

create or replace function app_private.update_customer_internal(
  p_customer_id uuid, p_name text, p_phone text, p_email text, p_notes text, p_is_active boolean
) returns void
language plpgsql security definer set search_path=''
as $$
declare v_branch uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select branch_id into v_branch from public.customers where id=p_customer_id for update;
  if v_branch is null then raise exception 'customer not found'; end if;
  if not app_private.current_user_has_permission('customers.manage',v_branch) then raise exception 'permission denied'; end if;
  if nullif(btrim(p_name),'') is null then raise exception 'customer name required'; end if;
  update public.customers set
    name=btrim(p_name), phone=nullif(btrim(p_phone),''), email=nullif(btrim(p_email),''),
    notes=nullif(btrim(p_notes),''), is_active=p_is_active, updated_at=now()
  where id=p_customer_id;
end $$;

create or replace function public.update_customer(
  p_customer_id uuid, p_name text, p_phone text, p_email text, p_notes text, p_is_active boolean
) returns void language sql set search_path=''
as $$ select app_private.update_customer_internal(p_customer_id,p_name,p_phone,p_email,p_notes,p_is_active); $$;

create or replace function app_private.create_customer_address_internal(
  p_customer_id uuid, p_label text, p_address_line text, p_area text default null,
  p_city text default null, p_delivery_notes text default null, p_is_default boolean default false
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_branch uuid; v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select branch_id into v_branch from public.customers where id=p_customer_id and is_active;
  if v_branch is null then raise exception 'active customer not found'; end if;
  if not (
    app_private.current_user_has_permission('customers.create',v_branch)
    or app_private.current_user_has_permission('customers.manage',v_branch)
  ) then raise exception 'permission denied'; end if;
  if nullif(btrim(p_address_line),'') is null then raise exception 'address required'; end if;
  if p_is_default then update public.customer_addresses set is_default=false,updated_at=now() where branch_id=v_branch and customer_id=p_customer_id and is_default; end if;
  insert into public.customer_addresses(branch_id,customer_id,label,address_line,area,city,delivery_notes,is_default,created_by)
  values(v_branch,p_customer_id,nullif(btrim(p_label),''),btrim(p_address_line),nullif(btrim(p_area),''),nullif(btrim(p_city),''),nullif(btrim(p_delivery_notes),''),p_is_default,auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.create_customer_address(
  p_customer_id uuid, p_label text, p_address_line text, p_area text default null,
  p_city text default null, p_delivery_notes text default null, p_is_default boolean default false
) returns uuid language sql set search_path=''
as $$ select app_private.create_customer_address_internal(p_customer_id,p_label,p_address_line,p_area,p_city,p_delivery_notes,p_is_default); $$;

create or replace function app_private.set_pos_order_customer_context_internal(
  p_order_id uuid, p_customer_id uuid default null, p_delivery_address_id uuid default null,
  p_drive_thru_reference text default null
) returns void
language plpgsql security definer set search_path=''
as $$
declare
  v_branch uuid; v_status text; v_type text;
  v_name text; v_phone text; v_address text; v_delivery_notes text; v_address_customer uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select branch_id,status,order_type into v_branch,v_status,v_type from public.orders where id=p_order_id for update;
  if v_branch is null then raise exception 'order not found'; end if;
  if not app_private.current_user_has_permission('pos.order.edit',v_branch) then raise exception 'permission denied'; end if;
  if v_status not in ('created','held','sent_to_kitchen','preparing') then raise exception 'order context cannot be edited in current state'; end if;

  if p_customer_id is not null then
    select name,phone into v_name,v_phone from public.customers where id=p_customer_id and branch_id=v_branch and is_active;
    if v_name is null then raise exception 'active customer not found'; end if;
  end if;

  if p_delivery_address_id is not null then
    select customer_id,
      concat_ws(', ',nullif(label,''),address_line,nullif(area,''),nullif(city,'')), delivery_notes
    into v_address_customer,v_address,v_delivery_notes
    from public.customer_addresses
    where id=p_delivery_address_id and branch_id=v_branch and is_active;
    if v_address_customer is null then raise exception 'active delivery address not found'; end if;
    if p_customer_id is null or v_address_customer<>p_customer_id then raise exception 'delivery address must belong to selected customer'; end if;
  end if;

  if v_type='delivery' and (p_customer_id is null or p_delivery_address_id is null) then
    raise exception 'delivery order requires customer and address';
  end if;
  if v_type<>'delivery' and p_delivery_address_id is not null then raise exception 'delivery address only allowed for delivery orders'; end if;
  if v_type<>'drive_thru' and nullif(btrim(p_drive_thru_reference),'') is not null then raise exception 'drive-thru reference only allowed for drive-thru orders'; end if;

  update public.orders set
    customer_id=p_customer_id,
    customer_name_snapshot=v_name,
    customer_phone_snapshot=v_phone,
    delivery_address_id=p_delivery_address_id,
    delivery_address_snapshot=v_address,
    delivery_notes_snapshot=v_delivery_notes,
    drive_thru_reference=case when v_type='drive_thru' then nullif(btrim(p_drive_thru_reference),'') else null end,
    updated_at=now()
  where id=p_order_id;
end $$;

create or replace function public.set_pos_order_customer_context(
  p_order_id uuid, p_customer_id uuid default null, p_delivery_address_id uuid default null,
  p_drive_thru_reference text default null
) returns void language sql set search_path=''
as $$ select app_private.set_pos_order_customer_context_internal(p_order_id,p_customer_id,p_delivery_address_id,p_drive_thru_reference); $$;

revoke all on function app_private.create_customer_internal(uuid,text,text,text,text) from public;
revoke all on function app_private.update_customer_internal(uuid,text,text,text,text,boolean) from public;
revoke all on function app_private.create_customer_address_internal(uuid,text,text,text,text,text,boolean) from public;
revoke all on function app_private.set_pos_order_customer_context_internal(uuid,uuid,uuid,text) from public;
grant execute on function app_private.create_customer_internal(uuid,text,text,text,text) to authenticated;
grant execute on function app_private.update_customer_internal(uuid,text,text,text,text,boolean) to authenticated;
grant execute on function app_private.create_customer_address_internal(uuid,text,text,text,text,text,boolean) to authenticated;
grant execute on function app_private.set_pos_order_customer_context_internal(uuid,uuid,uuid,text) to authenticated;

revoke all on function public.create_customer(uuid,text,text,text,text) from public;
revoke all on function public.update_customer(uuid,text,text,text,text,boolean) from public;
revoke all on function public.create_customer_address(uuid,text,text,text,text,text,boolean) from public;
revoke all on function public.set_pos_order_customer_context(uuid,uuid,uuid,text) from public;
grant execute on function public.create_customer(uuid,text,text,text,text) to authenticated;
grant execute on function public.update_customer(uuid,text,text,text,text,boolean) to authenticated;
grant execute on function public.create_customer_address(uuid,text,text,text,text,text,boolean) to authenticated;
grant execute on function public.set_pos_order_customer_context(uuid,uuid,uuid,text) to authenticated;
