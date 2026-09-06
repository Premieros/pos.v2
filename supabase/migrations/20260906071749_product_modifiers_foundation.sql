create table if not exists public.modifier_groups (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  code text not null,
  name_ar text not null,
  name_en text,
  min_select integer not null default 0 check (min_select >= 0),
  max_select integer not null default 1 check (max_select >= min_select),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(branch_id, code),
  unique(id, branch_id)
);

create table if not exists public.modifier_options (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  group_id uuid not null,
  code text not null,
  name_ar text not null,
  name_en text,
  price_delta numeric(14,2) not null default 0,
  inventory_item_id uuid,
  inventory_quantity numeric(14,3) not null default 0 check (inventory_quantity >= 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint modifier_options_group_branch_fk foreign key (group_id, branch_id) references public.modifier_groups(id, branch_id),
  constraint modifier_options_inventory_branch_fk foreign key (inventory_item_id, branch_id) references public.inventory_items(id, branch_id),
  unique(group_id, code),
  unique(id, branch_id)
);

create table if not exists public.product_modifier_groups (
  branch_id uuid not null references public.branches(id),
  product_id uuid not null,
  group_id uuid not null,
  sort_order integer not null default 0,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key(product_id, group_id),
  constraint product_modifier_groups_product_branch_fk foreign key (product_id, branch_id) references public.products(id, branch_id),
  constraint product_modifier_groups_group_branch_fk foreign key (group_id, branch_id) references public.modifier_groups(id, branch_id)
);

alter table public.order_items add column if not exists base_unit_price numeric(14,2);
update public.order_items set base_unit_price=unit_price where base_unit_price is null;
alter table public.order_items alter column base_unit_price set not null;

create table if not exists public.order_item_modifiers (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  order_item_id uuid not null,
  modifier_group_id uuid not null,
  modifier_option_id uuid not null,
  option_name_snapshot text not null,
  price_delta_snapshot numeric(14,2) not null,
  inventory_item_id_snapshot uuid,
  inventory_quantity_snapshot numeric(14,3) not null default 0,
  quantity numeric(14,3) not null default 1 check (quantity > 0),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint order_item_modifiers_item_branch_fk foreign key (order_item_id, branch_id) references public.order_items(id, branch_id) on delete cascade,
  constraint order_item_modifiers_group_branch_fk foreign key (modifier_group_id, branch_id) references public.modifier_groups(id, branch_id),
  constraint order_item_modifiers_option_branch_fk foreign key (modifier_option_id, branch_id) references public.modifier_options(id, branch_id),
  constraint order_item_modifiers_inventory_branch_fk foreign key (inventory_item_id_snapshot, branch_id) references public.inventory_items(id, branch_id)
);

create index if not exists modifier_options_group_branch_idx on public.modifier_options(group_id, branch_id);
create index if not exists modifier_options_inventory_branch_idx on public.modifier_options(inventory_item_id, branch_id) where inventory_item_id is not null;
create index if not exists product_modifier_groups_group_branch_idx on public.product_modifier_groups(group_id, branch_id);
create index if not exists order_item_modifiers_item_branch_idx on public.order_item_modifiers(order_item_id, branch_id);
create index if not exists order_item_modifiers_option_branch_idx on public.order_item_modifiers(modifier_option_id, branch_id);
create index if not exists order_item_modifiers_inventory_branch_idx on public.order_item_modifiers(inventory_item_id_snapshot, branch_id) where inventory_item_id_snapshot is not null;

alter table public.modifier_groups enable row level security;
alter table public.modifier_options enable row level security;
alter table public.product_modifier_groups enable row level security;
alter table public.order_item_modifiers enable row level security;

create policy modifier_groups_select on public.modifier_groups for select to authenticated using (
  app_private.user_may_access_branch(branch_id,(select auth.uid())) and (
    app_private.current_user_has_permission('catalog.view',branch_id) or
    app_private.current_user_has_permission('catalog.manage',branch_id) or
    app_private.current_user_has_permission('pos.view',branch_id)
  )
);
create policy modifier_options_select on public.modifier_options for select to authenticated using (
  app_private.user_may_access_branch(branch_id,(select auth.uid())) and (
    app_private.current_user_has_permission('catalog.view',branch_id) or
    app_private.current_user_has_permission('catalog.manage',branch_id) or
    app_private.current_user_has_permission('pos.view',branch_id)
  )
);
create policy product_modifier_groups_select on public.product_modifier_groups for select to authenticated using (
  app_private.user_may_access_branch(branch_id,(select auth.uid())) and (
    app_private.current_user_has_permission('catalog.view',branch_id) or
    app_private.current_user_has_permission('catalog.manage',branch_id) or
    app_private.current_user_has_permission('pos.view',branch_id)
  )
);
create policy order_item_modifiers_select on public.order_item_modifiers for select to authenticated using (
  app_private.user_may_access_branch(branch_id,(select auth.uid())) and app_private.current_user_has_permission('pos.view',branch_id)
);

revoke all on public.modifier_groups, public.modifier_options, public.product_modifier_groups, public.order_item_modifiers from authenticated;
grant select on public.modifier_groups, public.modifier_options, public.product_modifier_groups, public.order_item_modifiers to authenticated;

create or replace function app_private.recalculate_order_item_price(p_order_item_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_base numeric(14,2); v_unit numeric(14,2); v_qty numeric(14,3); v_order uuid;
begin
  select base_unit_price,quantity,order_id into v_base,v_qty,v_order from public.order_items where id=p_order_item_id for update;
  if v_order is null then raise exception 'order item not found'; end if;
  select round(v_base + coalesce(sum(price_delta_snapshot*quantity),0),2) into v_unit from public.order_item_modifiers where order_item_id=p_order_item_id;
  update public.order_items set unit_price=v_unit,line_total=round(v_unit*v_qty,2),updated_at=now() where id=p_order_item_id;
  perform app_private.recalculate_order_totals(v_order);
end $$;

create or replace function app_private.set_order_item_modifiers_internal(p_order_item_id uuid, p_selections jsonb)
returns void language plpgsql security definer set search_path=''
as $$
declare
  v_branch uuid; v_product uuid; v_status text; v_sent numeric; r record; g record; v_count integer;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(coalesce(p_selections,'[]'::jsonb)) <> 'array' then raise exception 'modifier selections must be an array'; end if;
  select oi.branch_id,oi.product_id,o.status,oi.sent_quantity into v_branch,v_product,v_status,v_sent
  from public.order_items oi join public.orders o on o.id=oi.order_id
  where oi.id=p_order_item_id for update of oi;
  if v_branch is null then raise exception 'order item not found'; end if;
  if not app_private.current_user_has_permission('pos.order.edit',v_branch) then raise exception 'permission denied'; end if;
  if v_status not in ('created','held','sent_to_kitchen','preparing') then raise exception 'order item cannot be customized in current state'; end if;
  if coalesce(v_sent,0) <> 0 then raise exception 'modifiers are locked after first kitchen send; replace the line instead'; end if;

  create temporary table if not exists pg_temp.requested_modifiers(option_id uuid, qty numeric) on commit drop;
  truncate pg_temp.requested_modifiers;
  insert into pg_temp.requested_modifiers(option_id,qty)
  select (x->>'option_id')::uuid, coalesce(nullif(x->>'quantity','')::numeric,1)
  from jsonb_array_elements(coalesce(p_selections,'[]'::jsonb)) x;
  if exists(select 1 from pg_temp.requested_modifiers where qty<=0) then raise exception 'modifier quantity must be positive'; end if;
  if exists(select option_id from pg_temp.requested_modifiers group by option_id having count(*)>1) then raise exception 'duplicate modifier option'; end if;

  if exists(
    select 1 from pg_temp.requested_modifiers rm
    left join public.modifier_options mo on mo.id=rm.option_id and mo.branch_id=v_branch and mo.is_active
    left join public.product_modifier_groups pmg on pmg.group_id=mo.group_id and pmg.product_id=v_product and pmg.branch_id=v_branch
    where mo.id is null or pmg.product_id is null
  ) then raise exception 'modifier option unavailable for product'; end if;

  for g in select mg.id,mg.min_select,mg.max_select from public.modifier_groups mg join public.product_modifier_groups pmg on pmg.group_id=mg.id and pmg.branch_id=mg.branch_id where pmg.product_id=v_product and mg.branch_id=v_branch and mg.is_active loop
    select count(*) into v_count from pg_temp.requested_modifiers rm join public.modifier_options mo on mo.id=rm.option_id where mo.group_id=g.id;
    if v_count < g.min_select or v_count > g.max_select then raise exception 'modifier group selection count out of range'; end if;
  end loop;

  delete from public.order_item_modifiers where order_item_id=p_order_item_id;
  for r in
    select mo.group_id,mo.id option_id,mo.name_ar,mo.price_delta,mo.inventory_item_id,mo.inventory_quantity,rm.qty
    from pg_temp.requested_modifiers rm join public.modifier_options mo on mo.id=rm.option_id
  loop
    insert into public.order_item_modifiers(branch_id,order_item_id,modifier_group_id,modifier_option_id,option_name_snapshot,price_delta_snapshot,inventory_item_id_snapshot,inventory_quantity_snapshot,quantity,created_by)
    values(v_branch,p_order_item_id,r.group_id,r.option_id,r.name_ar,r.price_delta,r.inventory_item_id,r.inventory_quantity,r.qty,auth.uid());
  end loop;
  perform app_private.recalculate_order_item_price(p_order_item_id);
end $$;

create or replace function public.set_order_item_modifiers(p_order_item_id uuid, p_selections jsonb)
returns void language sql set search_path=''
as $$ select app_private.set_order_item_modifiers_internal(p_order_item_id,p_selections); $$;

revoke all on function app_private.recalculate_order_item_price(uuid) from public,anon,authenticated;
revoke all on function app_private.set_order_item_modifiers_internal(uuid,jsonb) from public,anon;
grant execute on function app_private.set_order_item_modifiers_internal(uuid,jsonb) to authenticated;
revoke all on function public.set_order_item_modifiers(uuid,jsonb) from public,anon;
grant execute on function public.set_order_item_modifiers(uuid,jsonb) to authenticated;

create or replace function app_private.apply_modifier_stock_for_kitchen_ticket_item()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_branch uuid; v_warehouse uuid; r record; v_delta numeric; v_available numeric; v_key text;
begin
  select kt.branch_id,kt.warehouse_id,kt.idempotency_key into v_branch,v_warehouse,v_key from public.kitchen_tickets kt where kt.id=new.kitchen_ticket_id;
  for r in select oim.inventory_item_id_snapshot inventory_item_id,oim.inventory_quantity_snapshot,oim.quantity,oim.option_name_snapshot from public.order_item_modifiers oim where oim.order_item_id=new.order_item_id and oim.inventory_item_id_snapshot is not null and oim.inventory_quantity_snapshot>0 loop
    v_delta := -(new.quantity_delta*r.quantity*r.inventory_quantity_snapshot);
    if v_delta < 0 then
      select coalesce(sum(quantity_delta),0) into v_available from public.stock_movements where branch_id=v_branch and warehouse_id=v_warehouse and inventory_item_id=r.inventory_item_id;
      if v_available+v_delta < 0 then raise exception 'insufficient inventory for modifier %',r.option_name_snapshot; end if;
    end if;
    insert into public.stock_movements(branch_id,warehouse_id,inventory_item_id,movement_type,quantity_delta,reference_type,reference_id,note,idempotency_key,created_by,source_order_item_id)
    values(v_branch,v_warehouse,r.inventory_item_id,case when v_delta<0 then 'sale_consumption' else 'return_in' end,v_delta,'kitchen_ticket',new.kitchen_ticket_id,'Modifier delta: '||r.option_name_snapshot,v_key||':modifier:'||new.order_item_id::text||':'||r.inventory_item_id::text,auth.uid(),new.order_item_id);
  end loop;
  return new;
end $$;

revoke all on function app_private.apply_modifier_stock_for_kitchen_ticket_item() from public,anon,authenticated;
drop trigger if exists trg_apply_modifier_stock_for_kitchen_ticket_item on public.kitchen_ticket_items;
create trigger trg_apply_modifier_stock_for_kitchen_ticket_item
after insert on public.kitchen_ticket_items
for each row execute function app_private.apply_modifier_stock_for_kitchen_ticket_item();
