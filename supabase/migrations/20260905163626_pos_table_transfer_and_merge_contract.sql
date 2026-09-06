alter table public.orders add column if not exists merged_into_order_id uuid null;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status = any (array['created'::text,'held'::text,'sent_to_kitchen'::text,'preparing'::text,'ready'::text,'partially_paid'::text,'paid'::text,'closed'::text,'cancelled'::text,'voided'::text,'returned'::text,'merged'::text]));

alter table public.orders drop constraint if exists orders_merged_into_order_branch_fkey;
alter table public.orders add constraint orders_merged_into_order_branch_fkey foreign key (merged_into_order_id, branch_id) references public.orders(id, branch_id) on delete restrict;

create index if not exists idx_orders_merged_into_branch on public.orders(merged_into_order_id, branch_id) where merged_into_order_id is not null;

create table if not exists public.order_table_actions (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  action_type text not null check (action_type in ('transfer','merge')),
  order_id uuid not null,
  source_order_id uuid null,
  from_table_id uuid null,
  to_table_id uuid not null,
  reason text not null check (length(trim(reason)) >= 2),
  idempotency_key text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(branch_id,idempotency_key),
  foreign key(order_id,branch_id) references public.orders(id,branch_id) on delete restrict,
  foreign key(source_order_id,branch_id) references public.orders(id,branch_id) on delete restrict,
  foreign key(from_table_id,branch_id) references public.dining_tables(id,branch_id) on delete restrict,
  foreign key(to_table_id,branch_id) references public.dining_tables(id,branch_id) on delete restrict
);

create index if not exists idx_order_table_actions_order_branch on public.order_table_actions(order_id,branch_id);
create index if not exists idx_order_table_actions_source_branch on public.order_table_actions(source_order_id,branch_id) where source_order_id is not null;
create index if not exists idx_order_table_actions_branch_created on public.order_table_actions(branch_id,created_at desc);
create index if not exists idx_order_table_actions_created_by on public.order_table_actions(created_by);

alter table public.order_table_actions enable row level security;
revoke all on public.order_table_actions from anon, authenticated;
grant select on public.order_table_actions to authenticated;

create policy order_table_actions_select on public.order_table_actions for select to authenticated using (
  app_private.current_user_may_access_branch(branch_id)
  and (app_private.current_user_has_permission('pos.view',branch_id) or app_private.current_user_has_permission('pos.order.transfer',branch_id))
);

create or replace function app_private.transfer_order_table_internal(p_order_id uuid,p_to_table_id uuid,p_reason text,p_idempotency_key text)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid := auth.uid();
  v_branch_id uuid;
  v_order_type text;
  v_status text;
  v_from_table_id uuid;
  v_action_id uuid;
  v_key text := nullif(trim(p_idempotency_key),'');
  v_reason text := nullif(trim(p_reason),'');
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if v_key is null then raise exception 'idempotency key required'; end if;
  if v_reason is null or length(v_reason) < 2 then raise exception 'transfer reason required'; end if;

  select branch_id,order_type,status,dining_table_id into v_branch_id,v_order_type,v_status,v_from_table_id
  from public.orders where id=p_order_id for update;
  if v_branch_id is null then raise exception 'order not found'; end if;
  if not app_private.current_user_has_permission('pos.order.transfer',v_branch_id) then raise exception 'permission denied'; end if;
  if v_order_type <> 'dine_in' or v_from_table_id is null then raise exception 'only dine-in orders can be transferred'; end if;
  if v_status not in ('created','held','sent_to_kitchen','preparing','ready','partially_paid','paid') then raise exception 'order is not active'; end if;
  if p_to_table_id = v_from_table_id then raise exception 'target table is already assigned'; end if;

  select id into v_action_id from public.order_table_actions where branch_id=v_branch_id and idempotency_key=v_key limit 1;
  if v_action_id is not null then return v_action_id; end if;

  if not exists(select 1 from public.dining_tables t where t.id=p_to_table_id and t.branch_id=v_branch_id and t.is_active) then
    raise exception 'target table not found or inactive';
  end if;

  if exists(
    select 1 from public.orders o
    where o.branch_id=v_branch_id and o.dining_table_id=p_to_table_id and o.id<>p_order_id
      and o.status in ('created','held','sent_to_kitchen','preparing','ready','partially_paid','paid')
  ) then raise exception 'target table is occupied'; end if;

  update public.orders set dining_table_id=p_to_table_id,updated_at=now() where id=p_order_id;

  insert into public.order_table_actions(branch_id,action_type,order_id,from_table_id,to_table_id,reason,idempotency_key,created_by)
  values(v_branch_id,'transfer',p_order_id,v_from_table_id,p_to_table_id,v_reason,v_key,v_user_id)
  returning id into v_action_id;
  return v_action_id;
end $$;

create or replace function public.transfer_order_table(p_order_id uuid,p_to_table_id uuid,p_reason text,p_idempotency_key text)
returns uuid
language sql
security invoker
set search_path=''
as $$ select app_private.transfer_order_table_internal(p_order_id,p_to_table_id,p_reason,p_idempotency_key); $$;

grant execute on function public.transfer_order_table(uuid,uuid,text,text) to authenticated;
revoke execute on function app_private.transfer_order_table_internal(uuid,uuid,text,text) from public, anon, authenticated;

create or replace function app_private.merge_dine_in_orders_internal(p_target_order_id uuid,p_source_order_id uuid,p_reason text,p_idempotency_key text)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid := auth.uid();
  v_target_branch uuid; v_source_branch uuid;
  v_target_shift uuid; v_source_shift uuid;
  v_target_type text; v_source_type text;
  v_target_status text; v_source_status text;
  v_target_table uuid; v_source_table uuid;
  v_target_discount numeric; v_source_discount numeric;
  v_action_id uuid;
  v_key text := nullif(trim(p_idempotency_key),'');
  v_reason text := nullif(trim(p_reason),'');
  v_new_status text;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if p_target_order_id = p_source_order_id then raise exception 'source and target orders must differ'; end if;
  if v_key is null then raise exception 'idempotency key required'; end if;
  if v_reason is null or length(v_reason) < 2 then raise exception 'merge reason required'; end if;

  perform 1 from public.orders where id in (p_target_order_id,p_source_order_id) order by id for update;

  select branch_id,shift_id,order_type,status,dining_table_id,discount_total into v_target_branch,v_target_shift,v_target_type,v_target_status,v_target_table,v_target_discount
  from public.orders where id=p_target_order_id;
  select branch_id,shift_id,order_type,status,dining_table_id,discount_total into v_source_branch,v_source_shift,v_source_type,v_source_status,v_source_table,v_source_discount
  from public.orders where id=p_source_order_id;

  if v_target_branch is null or v_source_branch is null then raise exception 'order not found'; end if;
  if v_target_branch<>v_source_branch then raise exception 'orders must belong to the same branch'; end if;
  if not app_private.current_user_has_permission('pos.order.transfer',v_target_branch) then raise exception 'permission denied'; end if;
  if v_target_type<>'dine_in' or v_source_type<>'dine_in' then raise exception 'only dine-in orders can be merged'; end if;
  if v_target_shift<>v_source_shift then raise exception 'orders must belong to the same shift'; end if;
  if v_target_status not in ('created','held','sent_to_kitchen','preparing','ready') or v_source_status not in ('created','held','sent_to_kitchen','preparing','ready') then raise exception 'orders must be active and unpaid'; end if;
  if coalesce(v_target_discount,0)<>0 or coalesce(v_source_discount,0)<>0 then raise exception 'discounted orders cannot be merged'; end if;

  select id into v_action_id from public.order_table_actions where branch_id=v_target_branch and idempotency_key=v_key limit 1;
  if v_action_id is not null then return v_action_id; end if;

  if exists(select 1 from public.payment_allocations where order_id in (p_target_order_id,p_source_order_id)) then raise exception 'orders with payment history cannot be merged'; end if;
  if exists(select 1 from public.order_bill_splits where order_id in (p_target_order_id,p_source_order_id)) then raise exception 'split-bill orders cannot be merged'; end if;
  if exists(select 1 from public.order_returns where order_id in (p_target_order_id,p_source_order_id)) then raise exception 'orders with returns cannot be merged'; end if;

  update public.order_items set order_id=p_target_order_id where order_id=p_source_order_id and branch_id=v_target_branch;
  update public.kitchen_tickets set order_id=p_target_order_id where order_id=p_source_order_id and branch_id=v_target_branch;

  update public.orders
  set subtotal=coalesce((select round(sum(line_total),2) from public.order_items where order_id=p_target_order_id and not is_removed),0),
      discount_total=0,
      total=coalesce((select round(sum(line_total),2) from public.order_items where order_id=p_target_order_id and not is_removed),0),
      guest_count=(select coalesce(sum(guest_count),0) from public.orders where id in (p_target_order_id,p_source_order_id)),
      updated_at=now()
  where id=p_target_order_id;

  if exists(select 1 from public.kitchen_tickets where order_id=p_target_order_id and status='preparing') then v_new_status:='preparing';
  elsif exists(select 1 from public.kitchen_tickets where order_id=p_target_order_id and status='queued') then v_new_status:='sent_to_kitchen';
  elsif exists(select 1 from public.kitchen_tickets where order_id=p_target_order_id and status in ('ready','completed')) then v_new_status:='ready';
  else v_new_status:=case when v_target_status='held' then 'held' else 'created' end;
  end if;
  update public.orders set status=v_new_status,updated_at=now() where id=p_target_order_id;

  update public.orders set status='merged',merged_into_order_id=p_target_order_id,updated_at=now() where id=p_source_order_id;

  insert into public.order_table_actions(branch_id,action_type,order_id,source_order_id,from_table_id,to_table_id,reason,idempotency_key,created_by)
  values(v_target_branch,'merge',p_target_order_id,p_source_order_id,v_source_table,v_target_table,v_reason,v_key,v_user_id)
  returning id into v_action_id;
  return v_action_id;
end $$;

create or replace function public.merge_dine_in_orders(p_target_order_id uuid,p_source_order_id uuid,p_reason text,p_idempotency_key text)
returns uuid
language sql
security invoker
set search_path=''
as $$ select app_private.merge_dine_in_orders_internal(p_target_order_id,p_source_order_id,p_reason,p_idempotency_key); $$;

grant execute on function public.merge_dine_in_orders(uuid,uuid,text,text) to authenticated;
revoke execute on function app_private.merge_dine_in_orders_internal(uuid,uuid,text,text) from public, anon, authenticated;
