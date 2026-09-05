create table public.receipt_documents (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  order_id uuid not null,
  snapshot jsonb not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(order_id,branch_id),
  foreign key(order_id,branch_id) references public.orders(id,branch_id) on delete restrict
);

create table public.receipt_print_events (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  receipt_document_id uuid not null,
  order_id uuid not null,
  print_sequence integer not null check (print_sequence >= 1),
  event_type text not null check (event_type in ('first_print','reprint')),
  reason text null,
  idempotency_key text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(branch_id,idempotency_key),
  unique(receipt_document_id,print_sequence),
  foreign key(receipt_document_id) references public.receipt_documents(id) on delete restrict,
  foreign key(order_id,branch_id) references public.orders(id,branch_id) on delete restrict,
  check ((event_type='first_print' and reason is null) or (event_type='reprint' and length(trim(reason)) >= 2))
);

create index idx_receipt_documents_branch_created on public.receipt_documents(branch_id,created_at desc);
create index idx_receipt_documents_created_by on public.receipt_documents(created_by);
create index idx_receipt_print_events_order_branch on public.receipt_print_events(order_id,branch_id);
create index idx_receipt_print_events_document on public.receipt_print_events(receipt_document_id);
create index idx_receipt_print_events_branch_created on public.receipt_print_events(branch_id,created_at desc);
create index idx_receipt_print_events_created_by on public.receipt_print_events(created_by);

alter table public.receipt_documents enable row level security;
alter table public.receipt_print_events enable row level security;
revoke all on public.receipt_documents from anon,authenticated;
revoke all on public.receipt_print_events from anon,authenticated;
grant select on public.receipt_documents to authenticated;
grant select on public.receipt_print_events to authenticated;

create policy receipt_documents_select on public.receipt_documents for select to authenticated using (
  app_private.current_user_may_access_branch(branch_id)
  and (
    app_private.current_user_has_permission('pos.view',branch_id)
    or app_private.current_user_has_permission('pos.receipt.print',branch_id)
    or app_private.current_user_has_permission('pos.receipt.reprint',branch_id)
  )
);

create policy receipt_print_events_select on public.receipt_print_events for select to authenticated using (
  app_private.current_user_may_access_branch(branch_id)
  and (
    app_private.current_user_has_permission('pos.view',branch_id)
    or app_private.current_user_has_permission('pos.receipt.print',branch_id)
    or app_private.current_user_has_permission('pos.receipt.reprint',branch_id)
  )
);

create or replace function app_private.register_first_receipt_print_internal(p_order_id uuid,p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid := auth.uid();
  v_branch_id uuid;
  v_status text;
  v_document_id uuid;
  v_event_id uuid;
  v_snapshot jsonb;
  v_key text := nullif(trim(p_idempotency_key),'');
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if v_key is null then raise exception 'idempotency key required'; end if;

  select branch_id,status into v_branch_id,v_status from public.orders where id=p_order_id for update;
  if v_branch_id is null then raise exception 'order not found'; end if;
  if not app_private.current_user_has_permission('pos.receipt.print',v_branch_id) then raise exception 'permission denied'; end if;

  select e.id,d.id,d.snapshot into v_event_id,v_document_id,v_snapshot
  from public.receipt_print_events e
  join public.receipt_documents d on d.id=e.receipt_document_id
  where e.branch_id=v_branch_id and e.idempotency_key=v_key
  limit 1;
  if v_event_id is not null then
    return jsonb_build_object('document_id',v_document_id,'event_id',v_event_id,'sequence',1,'event_type','first_print','snapshot',v_snapshot);
  end if;

  if v_status not in ('paid','closed') then raise exception 'receipt can be printed only for paid or closed order'; end if;
  if exists(select 1 from public.receipt_documents where order_id=p_order_id and branch_id=v_branch_id) then raise exception 'receipt already printed; use reprint'; end if;

  select jsonb_build_object(
    'branch',jsonb_build_object('id',b.id,'code',b.code,'name_ar',b.name_ar,'name_en',b.name_en),
    'order',jsonb_build_object('id',o.id,'order_number',o.order_number,'order_type',o.order_type,'created_at',o.created_at,'guest_count',o.guest_count,'subtotal',o.subtotal,'discount_total',o.discount_total,'total',o.total),
    'items',coalesce((select jsonb_agg(jsonb_build_object('id',oi.id,'product_name',oi.product_name,'quantity',oi.quantity,'unit_price',oi.unit_price,'line_total',oi.line_total) order by oi.created_at) from public.order_items oi where oi.order_id=o.id and not oi.is_removed),'[]'::jsonb),
    'payments',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'method',p.method,'amount',pa.amount,'created_at',p.created_at) order by p.created_at) from public.payment_allocations pa join public.payments p on p.id=pa.payment_id and p.branch_id=pa.branch_id where pa.order_id=o.id and p.status='completed'),'[]'::jsonb),
    'captured_at',now()
  ) into v_snapshot
  from public.orders o join public.branches b on b.id=o.branch_id
  where o.id=p_order_id;

  insert into public.receipt_documents(branch_id,order_id,snapshot,created_by)
  values(v_branch_id,p_order_id,v_snapshot,v_user_id)
  returning id into v_document_id;

  insert into public.receipt_print_events(branch_id,receipt_document_id,order_id,print_sequence,event_type,reason,idempotency_key,created_by)
  values(v_branch_id,v_document_id,p_order_id,1,'first_print',null,v_key,v_user_id)
  returning id into v_event_id;

  return jsonb_build_object('document_id',v_document_id,'event_id',v_event_id,'sequence',1,'event_type','first_print','snapshot',v_snapshot);
end $$;

create or replace function public.register_first_receipt_print(p_order_id uuid,p_idempotency_key text)
returns jsonb
language sql
security invoker
set search_path=''
as $$ select app_private.register_first_receipt_print_internal(p_order_id,p_idempotency_key); $$;

grant execute on function public.register_first_receipt_print(uuid,text) to authenticated;
revoke execute on function app_private.register_first_receipt_print_internal(uuid,text) from public,anon,authenticated;

create or replace function app_private.register_receipt_reprint_internal(p_order_id uuid,p_reason text,p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid := auth.uid();
  v_branch_id uuid;
  v_document_id uuid;
  v_event_id uuid;
  v_snapshot jsonb;
  v_sequence integer;
  v_key text := nullif(trim(p_idempotency_key),'');
  v_reason text := nullif(trim(p_reason),'');
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if v_key is null then raise exception 'idempotency key required'; end if;
  if v_reason is null or length(v_reason)<2 then raise exception 'reprint reason required'; end if;

  select branch_id into v_branch_id from public.orders where id=p_order_id for update;
  if v_branch_id is null then raise exception 'order not found'; end if;
  if not app_private.current_user_has_permission('pos.receipt.reprint',v_branch_id) then raise exception 'permission denied'; end if;

  select e.id,e.print_sequence,d.id,d.snapshot into v_event_id,v_sequence,v_document_id,v_snapshot
  from public.receipt_print_events e
  join public.receipt_documents d on d.id=e.receipt_document_id
  where e.branch_id=v_branch_id and e.idempotency_key=v_key
  limit 1;
  if v_event_id is not null then
    return jsonb_build_object('document_id',v_document_id,'event_id',v_event_id,'sequence',v_sequence,'event_type','reprint','snapshot',v_snapshot);
  end if;

  select id,snapshot into v_document_id,v_snapshot from public.receipt_documents where order_id=p_order_id and branch_id=v_branch_id for update;
  if v_document_id is null then raise exception 'first receipt print does not exist'; end if;

  select coalesce(max(print_sequence),0)+1 into v_sequence from public.receipt_print_events where receipt_document_id=v_document_id;
  insert into public.receipt_print_events(branch_id,receipt_document_id,order_id,print_sequence,event_type,reason,idempotency_key,created_by)
  values(v_branch_id,v_document_id,p_order_id,v_sequence,'reprint',v_reason,v_key,v_user_id)
  returning id into v_event_id;

  return jsonb_build_object('document_id',v_document_id,'event_id',v_event_id,'sequence',v_sequence,'event_type','reprint','snapshot',v_snapshot);
end $$;

create or replace function public.register_receipt_reprint(p_order_id uuid,p_reason text,p_idempotency_key text)
returns jsonb
language sql
security invoker
set search_path=''
as $$ select app_private.register_receipt_reprint_internal(p_order_id,p_reason,p_idempotency_key); $$;

grant execute on function public.register_receipt_reprint(uuid,text,text) to authenticated;
revoke execute on function app_private.register_receipt_reprint_internal(uuid,text,text) from public,anon,authenticated;

create or replace function public.get_receipt_print_state(p_order_id uuid)
returns table(has_receipt boolean,last_sequence integer)
language sql
security invoker
set search_path=''
as $$
  select exists(select 1 from public.receipt_documents d where d.order_id=p_order_id),
         coalesce((select max(e.print_sequence) from public.receipt_print_events e where e.order_id=p_order_id),0);
$$;

grant execute on function public.get_receipt_print_state(uuid) to authenticated;
