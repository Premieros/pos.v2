insert into public.permissions(key,module,description) values
('pos.order.close','pos','Close a fully paid order')
on conflict (key) do nothing;

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  shift_id uuid not null,
  method text not null check (method in ('cash','card')),
  amount numeric(14,2) not null check (amount > 0),
  status text not null default 'completed' check (status in ('completed','refunded','voided')),
  idempotency_key text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(branch_id,idempotency_key),
  unique(id,branch_id),
  constraint payments_shift_branch_fkey foreign key (shift_id,branch_id) references public.shifts(id,branch_id) on delete restrict
);

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  payment_id uuid not null,
  order_id uuid not null,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique(payment_id,order_id),
  constraint payment_allocations_payment_branch_fkey foreign key (payment_id,branch_id) references public.payments(id,branch_id) on delete restrict,
  constraint payment_allocations_order_branch_fkey foreign key (order_id,branch_id) references public.orders(id,branch_id) on delete restrict
);

create index idx_payments_branch_created on public.payments(branch_id,created_at desc);
create index idx_payments_shift_branch on public.payments(shift_id,branch_id);
create index idx_payments_created_by on public.payments(created_by);
create index idx_payment_allocations_order_branch on public.payment_allocations(order_id,branch_id);
create index idx_payment_allocations_payment_branch on public.payment_allocations(payment_id,branch_id);

alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;
revoke all on public.payments,public.payment_allocations from anon,authenticated;
grant select on public.payments,public.payment_allocations to authenticated;

create policy payments_select on public.payments for select to authenticated
using ((select app_private.current_user_has_permission('pos.view',branch_id)) or (select app_private.current_user_has_permission('pos.payment.take',branch_id)));
create policy payment_allocations_select on public.payment_allocations for select to authenticated
using ((select app_private.current_user_has_permission('pos.view',branch_id)) or (select app_private.current_user_has_permission('pos.payment.take',branch_id)));

create or replace function app_private.take_payment_internal(p_order_id uuid,p_method text,p_amount numeric,p_idempotency_key text)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid := auth.uid();
  v_branch_id uuid;
  v_shift_id uuid;
  v_order_status text;
  v_total numeric(14,2);
  v_paid numeric(14,2);
  v_remaining numeric(14,2);
  v_payment_id uuid;
  v_existing_order uuid;
  v_key text := nullif(trim(p_idempotency_key),'');
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if p_method not in ('cash','card') then raise exception 'invalid payment method'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'payment amount must be positive'; end if;
  if v_key is null then raise exception 'idempotency key required'; end if;

  select branch_id,shift_id,status,total into v_branch_id,v_shift_id,v_order_status,v_total
  from public.orders where id=p_order_id for update;
  if v_branch_id is null then raise exception 'order not found'; end if;
  if not app_private.current_user_has_permission('pos.payment.take',v_branch_id) then raise exception 'permission denied'; end if;

  select p.id,pa.order_id into v_payment_id,v_existing_order
  from public.payments p
  join public.payment_allocations pa on pa.payment_id=p.id and pa.branch_id=p.branch_id
  where p.branch_id=v_branch_id and p.idempotency_key=v_key
  limit 1;
  if v_payment_id is not null then
    if v_existing_order<>p_order_id then raise exception 'idempotency key belongs to another order'; end if;
    return v_payment_id;
  end if;

  if v_order_status not in ('ready','partially_paid') then raise exception 'order is not ready for payment'; end if;
  if not exists(select 1 from public.shifts s where s.id=v_shift_id and s.branch_id=v_branch_id and s.status='open') then raise exception 'order shift is not open'; end if;

  select coalesce(sum(pa.amount),0) into v_paid
  from public.payment_allocations pa
  join public.payments p on p.id=pa.payment_id and p.branch_id=pa.branch_id
  where pa.order_id=p_order_id and p.status='completed';
  v_remaining:=round(v_total-v_paid,2);
  if v_remaining<=0 then raise exception 'order already fully paid'; end if;
  if round(p_amount,2)>v_remaining then raise exception 'payment exceeds remaining balance'; end if;

  insert into public.payments(branch_id,shift_id,method,amount,idempotency_key,created_by)
  values(v_branch_id,v_shift_id,p_method,round(p_amount,2),v_key,v_user_id)
  returning id into v_payment_id;

  insert into public.payment_allocations(branch_id,payment_id,order_id,amount)
  values(v_branch_id,v_payment_id,p_order_id,round(p_amount,2));

  if p_method='cash' then
    insert into public.cash_drawer_movements(branch_id,shift_id,movement_type,amount,reason,idempotency_key,created_by)
    values(v_branch_id,v_shift_id,'cash_in',round(p_amount,2),'POS cash payment '||v_payment_id::text,gen_random_uuid(),v_user_id);
  end if;

  if round(v_paid+p_amount,2)=v_total then
    update public.orders set status='paid',updated_at=now() where id=p_order_id;
  else
    update public.orders set status='partially_paid',updated_at=now() where id=p_order_id;
  end if;

  return v_payment_id;
end;
$$;

create or replace function app_private.close_paid_order_internal(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_branch_id uuid; v_status text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select branch_id,status into v_branch_id,v_status from public.orders where id=p_order_id for update;
  if v_branch_id is null then raise exception 'order not found'; end if;
  if not app_private.current_user_has_permission('pos.order.close',v_branch_id) then raise exception 'permission denied'; end if;
  if v_status<>'paid' then raise exception 'only fully paid orders can be closed'; end if;
  update public.orders set status='closed',updated_at=now() where id=p_order_id;
end;
$$;

revoke all on function app_private.take_payment_internal(uuid,text,numeric,text),app_private.close_paid_order_internal(uuid) from public,anon;
grant execute on function app_private.take_payment_internal(uuid,text,numeric,text),app_private.close_paid_order_internal(uuid) to authenticated;

create or replace function public.take_payment(p_order_id uuid,p_method text,p_amount numeric,p_idempotency_key text)
returns uuid language sql security invoker set search_path=''
as $$ select app_private.take_payment_internal(p_order_id,p_method,p_amount,p_idempotency_key); $$;

create or replace function public.close_paid_order(p_order_id uuid)
returns void language sql security invoker set search_path=''
as $$ select app_private.close_paid_order_internal(p_order_id); $$;

revoke all on function public.take_payment(uuid,text,numeric,text),public.close_paid_order(uuid) from public,anon;
grant execute on function public.take_payment(uuid,text,numeric,text),public.close_paid_order(uuid) to authenticated;
