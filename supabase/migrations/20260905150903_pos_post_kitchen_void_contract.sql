insert into public.permissions(key,module,description) values
('pos.order.void','pos','Void a post-kitchen order before payment')
on conflict (key) do update set module=excluded.module,description=excluded.description;

alter table public.orders
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users(id) on delete restrict,
  add column if not exists void_reason text;

create table public.order_voids (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  order_id uuid not null,
  reason text not null,
  idempotency_key text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint order_voids_order_branch_fkey foreign key (order_id,branch_id) references public.orders(id,branch_id) on delete restrict,
  unique(order_id),
  unique(branch_id,idempotency_key)
);

create index idx_order_voids_branch_created on public.order_voids(branch_id,created_at desc);
create index idx_order_voids_created_by on public.order_voids(created_by);
create index idx_orders_voided_by on public.orders(voided_by) where voided_by is not null;

alter table public.order_voids enable row level security;
revoke all on public.order_voids from anon,authenticated;
grant select on public.order_voids to authenticated;
create policy order_voids_select on public.order_voids for select to authenticated
using ((select app_private.current_user_has_permission('pos.view',branch_id)));

create or replace function app_private.void_pos_order_internal(p_order_id uuid,p_reason text,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_branch_id uuid;
  v_status text;
  v_void_id uuid;
  v_existing uuid;
  v_key text:=nullif(trim(p_idempotency_key),'');
  v_reverse numeric(14,3);
  v_available numeric(14,3);
  r record;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'void reason required'; end if;
  if v_key is null then raise exception 'idempotency key required'; end if;

  select branch_id,status into v_branch_id,v_status from public.orders where id=p_order_id for update;
  if v_branch_id is null then raise exception 'order not found'; end if;
  if not app_private.current_user_has_permission('pos.order.void',v_branch_id) then raise exception 'permission denied'; end if;

  select id into v_existing from public.order_voids where order_id=p_order_id or (branch_id=v_branch_id and idempotency_key=v_key) limit 1;
  if v_existing is not null then return v_existing; end if;

  if v_status not in ('sent_to_kitchen','preparing','ready') then raise exception 'only post-kitchen unpaid order can be voided'; end if;
  if exists(
    select 1 from public.payment_allocations pa
    join public.payments p on p.id=pa.payment_id and p.branch_id=pa.branch_id
    where pa.order_id=p_order_id and p.status='completed'
  ) then raise exception 'paid order requires return/refund flow'; end if;

  insert into public.order_voids(branch_id,order_id,reason,idempotency_key,created_by)
  values(v_branch_id,p_order_id,trim(p_reason),v_key,v_user_id)
  returning id into v_void_id;

  for r in
    select sm.id,sm.warehouse_id,sm.inventory_item_id,sm.quantity_delta
    from public.stock_movements sm
    join public.kitchen_tickets kt on kt.id=sm.reference_id and kt.branch_id=sm.branch_id
    where kt.order_id=p_order_id and sm.reference_type='kitchen_ticket'
    order by sm.created_at,sm.id
  loop
    v_reverse:=-r.quantity_delta;
    if v_reverse<0 then
      select coalesce(sum(quantity_delta),0) into v_available
      from public.stock_movements
      where branch_id=v_branch_id and warehouse_id=r.warehouse_id and inventory_item_id=r.inventory_item_id;
      if v_available+v_reverse<0 then raise exception 'insufficient inventory to reverse prior kitchen return'; end if;
    end if;

    insert into public.stock_movements(
      branch_id,warehouse_id,inventory_item_id,movement_type,quantity_delta,
      reference_type,reference_id,note,idempotency_key,created_by
    ) values (
      v_branch_id,r.warehouse_id,r.inventory_item_id,
      case when v_reverse<0 then 'sale_consumption' else 'return_in' end,
      v_reverse,'order_void',v_void_id,'Void reversal for order '||p_order_id::text,
      v_key||':'||r.id::text,v_user_id
    );
  end loop;

  update public.kitchen_tickets set status='cancelled',completed_at=coalesce(completed_at,now()) where order_id=p_order_id and status<>'cancelled';
  update public.orders set status='voided',voided_at=now(),voided_by=v_user_id,void_reason=trim(p_reason),updated_at=now() where id=p_order_id;
  return v_void_id;
end $$;

grant usage on schema app_private to authenticated;
revoke all on function app_private.void_pos_order_internal(uuid,text,text) from public,anon;
grant execute on function app_private.void_pos_order_internal(uuid,text,text) to authenticated;

create or replace function public.void_pos_order(p_order_id uuid,p_reason text,p_idempotency_key text)
returns uuid language sql security invoker set search_path='' as $$
  select app_private.void_pos_order_internal(p_order_id,p_reason,p_idempotency_key);
$$;
revoke all on function public.void_pos_order(uuid,text,text) from public,anon;
grant execute on function public.void_pos_order(uuid,text,text) to authenticated;
