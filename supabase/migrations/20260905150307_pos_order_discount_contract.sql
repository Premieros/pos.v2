alter table public.orders
  add column if not exists discount_type text check (discount_type in ('fixed','percent')),
  add column if not exists discount_value numeric(14,3),
  add column if not exists discount_reason text,
  add column if not exists discounted_by uuid references auth.users(id) on delete restrict,
  add column if not exists discounted_at timestamptz;

alter table public.orders drop constraint if exists orders_discount_metadata_chk;
alter table public.orders add constraint orders_discount_metadata_chk check (
  (discount_type is null and discount_value is null and discount_reason is null and discounted_by is null and discounted_at is null and discount_total = 0)
  or
  (discount_type is not null and discount_value is not null and discount_value > 0 and discount_reason is not null and discounted_by is not null and discounted_at is not null)
);

create table public.order_discount_audit (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  order_id uuid not null,
  action text not null check (action in ('apply','clear')),
  discount_type text check (discount_type in ('fixed','percent')),
  discount_value numeric(14,3),
  discount_amount numeric(14,2) not null check (discount_amount >= 0),
  reason text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint order_discount_audit_order_branch_fkey foreign key (order_id,branch_id) references public.orders(id,branch_id) on delete restrict
);

create index idx_order_discount_audit_order_branch on public.order_discount_audit(order_id,branch_id,created_at desc);
create index idx_order_discount_audit_branch_created on public.order_discount_audit(branch_id,created_at desc);
create index idx_order_discount_audit_created_by on public.order_discount_audit(created_by);
create index idx_orders_discounted_by on public.orders(discounted_by) where discounted_by is not null;

alter table public.order_discount_audit enable row level security;
revoke all on public.order_discount_audit from anon,authenticated;
grant select on public.order_discount_audit to authenticated;
create policy order_discount_audit_select on public.order_discount_audit for select to authenticated
using ((select app_private.current_user_has_permission('pos.view',branch_id)));

create or replace function app_private.recalculate_order_totals(p_order_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare
  v_subtotal numeric(14,2);
  v_type text;
  v_value numeric(14,3);
  v_discount numeric(14,2):=0;
begin
  select coalesce(sum(round(oi.unit_price * oi.quantity,2)),0) into v_subtotal
  from public.order_items oi where oi.order_id=p_order_id and not oi.is_removed;

  select discount_type,discount_value into v_type,v_value from public.orders where id=p_order_id;
  if v_type='fixed' then
    v_discount:=least(v_subtotal,round(v_value,2));
  elsif v_type='percent' then
    v_discount:=least(v_subtotal,round(v_subtotal*(v_value/100.0),2));
  end if;

  update public.orders
  set subtotal=v_subtotal,discount_total=v_discount,total=greatest(v_subtotal-v_discount,0),updated_at=now()
  where id=p_order_id;
end $$;
revoke all on function app_private.recalculate_order_totals(uuid) from public,anon,authenticated;

create or replace function app_private.apply_order_discount_internal(p_order_id uuid,p_discount_type text,p_discount_value numeric,p_reason text)
returns void language plpgsql security definer set search_path=''
as $$
declare
  v_branch_id uuid;
  v_status text;
  v_subtotal numeric(14,2);
  v_discount numeric(14,2);
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select branch_id,status,subtotal into v_branch_id,v_status,v_subtotal from public.orders where id=p_order_id for update;
  if v_branch_id is null then raise exception 'order not found'; end if;
  if not app_private.current_user_has_permission('pos.discount.apply',v_branch_id) then raise exception 'permission denied'; end if;
  if v_status not in ('created','held','sent_to_kitchen','preparing','ready') then raise exception 'discount cannot be changed in current state'; end if;
  if exists(select 1 from public.payment_allocations pa join public.payments p on p.id=pa.payment_id and p.branch_id=pa.branch_id where pa.order_id=p_order_id and p.status='completed') then raise exception 'discount cannot change after payment starts'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'discount reason required'; end if;
  if p_discount_type not in ('fixed','percent') then raise exception 'invalid discount type'; end if;
  if p_discount_value is null or p_discount_value<=0 then raise exception 'discount value must be positive'; end if;
  if p_discount_type='percent' and p_discount_value>100 then raise exception 'discount percent cannot exceed 100'; end if;
  if p_discount_type='fixed' and p_discount_value>v_subtotal then raise exception 'fixed discount cannot exceed subtotal'; end if;

  update public.orders set
    discount_type=p_discount_type,
    discount_value=p_discount_value,
    discount_reason=trim(p_reason),
    discounted_by=auth.uid(),
    discounted_at=now()
  where id=p_order_id;
  perform app_private.recalculate_order_totals(p_order_id);
  select discount_total into v_discount from public.orders where id=p_order_id;

  insert into public.order_discount_audit(branch_id,order_id,action,discount_type,discount_value,discount_amount,reason,created_by)
  values(v_branch_id,p_order_id,'apply',p_discount_type,p_discount_value,v_discount,trim(p_reason),auth.uid());
end $$;

create or replace function app_private.clear_order_discount_internal(p_order_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=''
as $$
declare
  v_branch_id uuid;
  v_status text;
  v_old_discount numeric(14,2);
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select branch_id,status,discount_total into v_branch_id,v_status,v_old_discount from public.orders where id=p_order_id for update;
  if v_branch_id is null then raise exception 'order not found'; end if;
  if not app_private.current_user_has_permission('pos.discount.apply',v_branch_id) then raise exception 'permission denied'; end if;
  if v_status not in ('created','held','sent_to_kitchen','preparing','ready') then raise exception 'discount cannot be changed in current state'; end if;
  if exists(select 1 from public.payment_allocations pa join public.payments p on p.id=pa.payment_id and p.branch_id=pa.branch_id where pa.order_id=p_order_id and p.status='completed') then raise exception 'discount cannot change after payment starts'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'discount clear reason required'; end if;

  update public.orders set discount_type=null,discount_value=null,discount_reason=null,discounted_by=null,discounted_at=null,discount_total=0 where id=p_order_id;
  perform app_private.recalculate_order_totals(p_order_id);
  insert into public.order_discount_audit(branch_id,order_id,action,discount_amount,reason,created_by)
  values(v_branch_id,p_order_id,'clear',coalesce(v_old_discount,0),trim(p_reason),auth.uid());
end $$;

grant usage on schema app_private to authenticated;
revoke all on function app_private.apply_order_discount_internal(uuid,text,numeric,text),app_private.clear_order_discount_internal(uuid,text) from public,anon;
grant execute on function app_private.apply_order_discount_internal(uuid,text,numeric,text),app_private.clear_order_discount_internal(uuid,text) to authenticated;

create or replace function public.apply_order_discount(p_order_id uuid,p_discount_type text,p_discount_value numeric,p_reason text)
returns void language sql security invoker set search_path='' as $$ select app_private.apply_order_discount_internal(p_order_id,p_discount_type,p_discount_value,p_reason); $$;
create or replace function public.clear_order_discount(p_order_id uuid,p_reason text)
returns void language sql security invoker set search_path='' as $$ select app_private.clear_order_discount_internal(p_order_id,p_reason); $$;
revoke all on function public.apply_order_discount(uuid,text,numeric,text),public.clear_order_discount(uuid,text) from public,anon;
grant execute on function public.apply_order_discount(uuid,text,numeric,text),public.clear_order_discount(uuid,text) to authenticated;
