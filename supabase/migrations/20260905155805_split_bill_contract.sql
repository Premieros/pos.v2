create table public.order_bill_splits (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  order_id uuid not null,
  label text not null check (btrim(label) <> ''),
  total_amount numeric(14,2) not null check (total_amount > 0),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(id, branch_id),
  foreign key(order_id, branch_id) references public.orders(id, branch_id)
);

create table public.order_bill_split_lines (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  split_id uuid not null,
  order_item_id uuid not null,
  quantity numeric(14,3) not null check (quantity > 0),
  amount numeric(14,2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  foreign key(split_id, branch_id) references public.order_bill_splits(id, branch_id),
  foreign key(order_item_id, branch_id) references public.order_items(id, branch_id)
);

alter table public.payment_allocations add column bill_split_id uuid;
alter table public.payment_allocations
  add constraint payment_allocations_bill_split_branch_fkey
  foreign key (bill_split_id, branch_id) references public.order_bill_splits(id, branch_id);

create index idx_order_bill_splits_order_branch on public.order_bill_splits(order_id, branch_id);
create index idx_order_bill_splits_created_by on public.order_bill_splits(created_by);
create index idx_order_bill_split_lines_split_branch on public.order_bill_split_lines(split_id, branch_id);
create index idx_order_bill_split_lines_item_branch on public.order_bill_split_lines(order_item_id, branch_id);
create index idx_order_bill_split_lines_branch on public.order_bill_split_lines(branch_id);
create index idx_payment_allocations_bill_split_branch on public.payment_allocations(bill_split_id, branch_id) where bill_split_id is not null;

alter table public.order_bill_splits enable row level security;
alter table public.order_bill_split_lines enable row level security;

create policy order_bill_splits_select on public.order_bill_splits for select to authenticated
using(app_private.current_user_may_access_branch(branch_id) and app_private.current_user_has_permission('pos.view', branch_id));
create policy order_bill_split_lines_select on public.order_bill_split_lines for select to authenticated
using(app_private.current_user_may_access_branch(branch_id) and app_private.current_user_has_permission('pos.view', branch_id));

create or replace function app_private.create_order_bill_split_internal(p_order_id uuid, p_splits jsonb)
returns setof public.order_bill_splits language plpgsql security definer set search_path=''
as $$
declare
 v_user uuid:=auth.uid(); v_branch uuid; v_status text; v_total numeric; v_subtotal numeric; s jsonb; l jsonb; v_split uuid; v_label text; v_item uuid; v_qty numeric; v_orig numeric; v_unit numeric; v_alloc_qty numeric; v_split_total numeric; v_sum_total numeric:=0; v_last_split uuid; v_last_line uuid; v_diff numeric;
begin
 if v_user is null then raise exception 'authentication required'; end if;
 select branch_id,status,total,subtotal into v_branch,v_status,v_total,v_subtotal from public.orders where id=p_order_id for update;
 if v_branch is null then raise exception 'order not found'; end if;
 if not app_private.current_user_has_permission('pos.order.split',v_branch) then raise exception 'permission denied'; end if;
 if v_status<>'ready' then raise exception 'order must be ready and unpaid before bill split'; end if;
 if exists(select 1 from public.payment_allocations pa join public.payments p on p.id=pa.payment_id and p.branch_id=pa.branch_id where pa.order_id=p_order_id and p.status='completed') then raise exception 'cannot split after payment starts'; end if;
 if exists(select 1 from public.order_bill_splits where order_id=p_order_id) then raise exception 'order is already split'; end if;
 if jsonb_typeof(p_splits)<>'array' or jsonb_array_length(p_splits)<2 then raise exception 'at least two bill splits required'; end if;

 for s in select value from jsonb_array_elements(p_splits) loop
  v_label:=nullif(trim(s->>'label'),''); if v_label is null then raise exception 'split label required'; end if;
  if jsonb_typeof(s->'lines')<>'array' or jsonb_array_length(s->'lines')=0 then raise exception 'split lines required'; end if;
  insert into public.order_bill_splits(branch_id,order_id,label,total_amount,created_by) values(v_branch,p_order_id,v_label,0.01,v_user) returning id into v_split;
  v_split_total:=0;
  for l in select value from jsonb_array_elements(s->'lines') loop
   v_item:=(l->>'order_item_id')::uuid; v_qty:=(l->>'quantity')::numeric;
   if v_qty is null or v_qty<=0 then raise exception 'split quantity must be positive'; end if;
   select quantity,unit_price into v_orig,v_unit from public.order_items where id=v_item and order_id=p_order_id and not is_removed;
   if v_orig is null then raise exception 'order item unavailable for split'; end if;
   select coalesce(sum(quantity),0) into v_alloc_qty from public.order_bill_split_lines where order_item_id=v_item;
   if v_alloc_qty+v_qty>v_orig then raise exception 'split quantity exceeds order item quantity'; end if;
   v_diff:=round(v_unit*v_qty*case when v_subtotal>0 then v_total/v_subtotal else 0 end,2);
   insert into public.order_bill_split_lines(branch_id,split_id,order_item_id,quantity,amount) values(v_branch,v_split,v_item,v_qty,v_diff) returning id into v_last_line;
   v_split_total:=v_split_total+v_diff;
  end loop;
  update public.order_bill_splits set total_amount=v_split_total where id=v_split;
  v_sum_total:=v_sum_total+v_split_total; v_last_split:=v_split;
 end loop;

 if exists(select 1 from public.order_items oi where oi.order_id=p_order_id and not oi.is_removed and coalesce((select sum(sl.quantity) from public.order_bill_split_lines sl where sl.order_item_id=oi.id),0)<>oi.quantity) then raise exception 'all order item quantities must be allocated exactly once'; end if;
 v_diff:=round(v_total-v_sum_total,2);
 if v_diff<>0 then
   update public.order_bill_split_lines set amount=amount+v_diff where id=v_last_line;
   update public.order_bill_splits set total_amount=total_amount+v_diff where id=v_last_split;
 end if;
 return query select * from public.order_bill_splits where order_id=p_order_id order by created_at,id;
end $$;

create or replace function app_private.take_payment_internal(p_order_id uuid,p_method text,p_amount numeric,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user_id uuid:=auth.uid(); v_branch_id uuid; v_shift_id uuid; v_order_status text; v_total numeric(14,2); v_paid numeric(14,2); v_remaining numeric(14,2); v_payment_id uuid; v_existing_order uuid; v_key text:=nullif(trim(p_idempotency_key),'');
begin
 if v_user_id is null then raise exception 'authentication required'; end if;
 if p_method not in('cash','card') then raise exception 'invalid payment method'; end if;
 if p_amount is null or p_amount<=0 then raise exception 'payment amount must be positive'; end if;
 if v_key is null then raise exception 'idempotency key required'; end if;
 select branch_id,shift_id,status,total into v_branch_id,v_shift_id,v_order_status,v_total from public.orders where id=p_order_id for update;
 if v_branch_id is null then raise exception 'order not found'; end if;
 if not app_private.current_user_has_permission('pos.payment.take',v_branch_id) then raise exception 'permission denied'; end if;
 if exists(select 1 from public.order_bill_splits where order_id=p_order_id) then raise exception 'order has bill splits; pay a split instead'; end if;
 select p.id,pa.order_id into v_payment_id,v_existing_order from public.payments p join public.payment_allocations pa on pa.payment_id=p.id and pa.branch_id=p.branch_id where p.branch_id=v_branch_id and p.idempotency_key=v_key limit 1;
 if v_payment_id is not null then if v_existing_order<>p_order_id then raise exception 'idempotency key belongs to another order'; end if; return v_payment_id; end if;
 if v_order_status not in('ready','partially_paid') then raise exception 'order is not ready for payment'; end if;
 if not exists(select 1 from public.shifts s where s.id=v_shift_id and s.branch_id=v_branch_id and s.status='open') then raise exception 'order shift is not open'; end if;
 select coalesce(sum(pa.amount),0) into v_paid from public.payment_allocations pa join public.payments p on p.id=pa.payment_id and p.branch_id=pa.branch_id where pa.order_id=p_order_id and p.status='completed';
 v_remaining:=round(v_total-v_paid,2);
 if v_remaining<=0 then raise exception 'order already fully paid'; end if;
 if round(p_amount,2)>v_remaining then raise exception 'payment exceeds remaining balance'; end if;
 insert into public.payments(branch_id,shift_id,method,amount,idempotency_key,created_by) values(v_branch_id,v_shift_id,p_method,round(p_amount,2),v_key,v_user_id) returning id into v_payment_id;
 insert into public.payment_allocations(branch_id,payment_id,order_id,amount) values(v_branch_id,v_payment_id,p_order_id,round(p_amount,2));
 if p_method='cash' then insert into public.cash_drawer_movements(branch_id,shift_id,movement_type,amount,reason,idempotency_key,created_by) values(v_branch_id,v_shift_id,'cash_in',round(p_amount,2),'POS cash payment '||v_payment_id::text,gen_random_uuid(),v_user_id); end if;
 if round(v_paid+p_amount,2)=v_total then update public.orders set status='paid',updated_at=now() where id=p_order_id; else update public.orders set status='partially_paid',updated_at=now() where id=p_order_id; end if;
 return v_payment_id;
end $$;

create or replace function app_private.take_split_payment_internal(p_split_id uuid,p_method text,p_amount numeric,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_branch uuid; v_order uuid; v_shift uuid; v_status text; v_split_total numeric; v_split_paid numeric; v_order_total numeric; v_order_paid numeric; v_payment uuid; v_key text:=nullif(trim(p_idempotency_key),'');
begin
 if v_user is null then raise exception 'authentication required'; end if;
 if p_method not in('cash','card') then raise exception 'invalid payment method'; end if;
 if p_amount is null or p_amount<=0 then raise exception 'payment amount must be positive'; end if;
 if v_key is null then raise exception 'idempotency key required'; end if;
 select bs.branch_id,bs.order_id,bs.total_amount,o.shift_id,o.status,o.total into v_branch,v_order,v_split_total,v_shift,v_status,v_order_total from public.order_bill_splits bs join public.orders o on o.id=bs.order_id and o.branch_id=bs.branch_id where bs.id=p_split_id for update of o,bs;
 if v_branch is null then raise exception 'bill split not found'; end if;
 if not app_private.current_user_has_permission('pos.payment.take',v_branch) then raise exception 'permission denied'; end if;
 select p.id into v_payment from public.payments p join public.payment_allocations pa on pa.payment_id=p.id and pa.branch_id=p.branch_id where p.branch_id=v_branch and p.idempotency_key=v_key and pa.bill_split_id=p_split_id limit 1;
 if v_payment is not null then return v_payment; end if;
 if v_status not in('ready','partially_paid') then raise exception 'order is not ready for payment'; end if;
 if not exists(select 1 from public.shifts where id=v_shift and status='open') then raise exception 'order shift is not open'; end if;
 select coalesce(sum(pa.amount),0) into v_split_paid from public.payment_allocations pa join public.payments p on p.id=pa.payment_id and p.branch_id=pa.branch_id where pa.bill_split_id=p_split_id and p.status='completed';
 if round(p_amount,2)>round(v_split_total-v_split_paid,2) then raise exception 'payment exceeds split remaining balance'; end if;
 insert into public.payments(branch_id,shift_id,method,amount,idempotency_key,created_by) values(v_branch,v_shift,p_method,round(p_amount,2),v_key,v_user) returning id into v_payment;
 insert into public.payment_allocations(branch_id,payment_id,order_id,bill_split_id,amount) values(v_branch,v_payment,v_order,p_split_id,round(p_amount,2));
 if p_method='cash' then insert into public.cash_drawer_movements(branch_id,shift_id,movement_type,amount,reason,idempotency_key,created_by) values(v_branch,v_shift,'cash_in',round(p_amount,2),'POS split cash payment '||v_payment::text,gen_random_uuid(),v_user); end if;
 select coalesce(sum(pa.amount),0) into v_order_paid from public.payment_allocations pa join public.payments p on p.id=pa.payment_id and p.branch_id=pa.branch_id where pa.order_id=v_order and p.status='completed';
 if round(v_order_paid,2)=v_order_total then update public.orders set status='paid',updated_at=now() where id=v_order; else update public.orders set status='partially_paid',updated_at=now() where id=v_order; end if;
 return v_payment;
end $$;

revoke all on function app_private.create_order_bill_split_internal(uuid,jsonb),app_private.take_split_payment_internal(uuid,text,numeric,text) from public,anon,authenticated;
grant execute on function app_private.create_order_bill_split_internal(uuid,jsonb),app_private.take_split_payment_internal(uuid,text,numeric,text) to authenticated;

create or replace function public.create_order_bill_split(p_order_id uuid,p_splits jsonb)
returns setof public.order_bill_splits language sql security invoker set search_path='' as $$ select * from app_private.create_order_bill_split_internal(p_order_id,p_splits); $$;
create or replace function public.take_split_payment(p_split_id uuid,p_method text,p_amount numeric,p_idempotency_key text)
returns uuid language sql security invoker set search_path='' as $$ select app_private.take_split_payment_internal(p_split_id,p_method,p_amount,p_idempotency_key); $$;
revoke all on function public.create_order_bill_split(uuid,jsonb),public.take_split_payment(uuid,text,numeric,text) from public,anon;
grant execute on function public.create_order_bill_split(uuid,jsonb),public.take_split_payment(uuid,text,numeric,text) to authenticated;
