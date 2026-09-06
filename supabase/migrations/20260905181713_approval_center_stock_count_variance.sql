insert into public.permissions(key,module,description) values
 ('approvals.view','approvals','View approval requests'),
 ('approvals.review','approvals','Approve or reject approval requests'),
 ('approvals.self_review','approvals','Allow reviewing own approval requests')
on conflict(key) do update set module=excluded.module,description=excluded.description;

create table public.approval_requests (
 id uuid primary key default gen_random_uuid(), branch_id uuid not null references public.branches(id),
 request_type text not null check(request_type in('stock_count_variance')), stock_count_session_id uuid not null,
 status text not null default 'pending' check(status in('pending','approved','rejected')),
 requested_by uuid not null references auth.users(id), requested_at timestamptz not null default now(),
 reviewed_by uuid references auth.users(id), reviewed_at timestamptz, review_reason text,
 unique(id,branch_id), unique(request_type,stock_count_session_id),
 foreign key(stock_count_session_id,branch_id) references public.stock_count_sessions(id,branch_id));

alter table public.stock_count_lines add column stock_movement_id uuid references public.stock_movements(id);
create index idx_approval_requests_branch_status on public.approval_requests(branch_id,status,requested_at desc);
create index idx_approval_requests_session_branch on public.approval_requests(stock_count_session_id,branch_id);
create index idx_approval_requests_requested_by on public.approval_requests(requested_by);
create index idx_approval_requests_reviewed_by on public.approval_requests(reviewed_by) where reviewed_by is not null;
create index idx_stock_count_lines_stock_movement on public.stock_count_lines(stock_movement_id) where stock_movement_id is not null;

alter table public.approval_requests enable row level security;
create policy approval_requests_select on public.approval_requests for select to authenticated using(app_private.has_permission('approvals.view',branch_id,(select auth.uid())) or app_private.has_permission('approvals.review',branch_id,(select auth.uid())));
revoke all on public.approval_requests from anon,authenticated; grant select on public.approval_requests to authenticated;

drop policy if exists stock_count_sessions_select on public.stock_count_sessions;
create policy stock_count_sessions_select on public.stock_count_sessions for select to authenticated using(app_private.has_permission('inventory.count',branch_id,(select auth.uid())) or app_private.has_permission('approvals.view',branch_id,(select auth.uid())) or app_private.has_permission('approvals.review',branch_id,(select auth.uid())));
drop policy if exists stock_count_lines_select on public.stock_count_lines;
create policy stock_count_lines_select on public.stock_count_lines for select to authenticated using(app_private.has_permission('inventory.count',branch_id,(select auth.uid())) or app_private.has_permission('approvals.view',branch_id,(select auth.uid())) or app_private.has_permission('approvals.review',branch_id,(select auth.uid())));

drop policy if exists warehouses_select on public.warehouses;
create policy warehouses_select on public.warehouses for select to authenticated using(app_private.current_user_may_access_branch(branch_id) and (app_private.current_user_has_permission('inventory.view',branch_id) or app_private.current_user_has_permission('procurement.purchases.receive',branch_id) or app_private.current_user_has_permission('inventory.count',branch_id) or app_private.current_user_has_permission('approvals.view',branch_id) or app_private.current_user_has_permission('approvals.review',branch_id)));
drop policy if exists inventory_items_select on public.inventory_items;
create policy inventory_items_select on public.inventory_items for select to authenticated using(app_private.current_user_may_access_branch(branch_id) and (app_private.current_user_has_permission('inventory.view',branch_id) or app_private.current_user_has_permission('procurement.purchases.view',branch_id) or app_private.current_user_has_permission('procurement.purchases.create',branch_id) or app_private.current_user_has_permission('procurement.purchases.edit',branch_id) or app_private.current_user_has_permission('procurement.purchases.submit',branch_id) or app_private.current_user_has_permission('procurement.purchases.cancel',branch_id) or app_private.current_user_has_permission('procurement.purchases.receive',branch_id) or app_private.current_user_has_permission('inventory.count',branch_id) or app_private.current_user_has_permission('approvals.view',branch_id) or app_private.current_user_has_permission('approvals.review',branch_id)));

create or replace function app_private.submit_stock_count_session_internal(p_session_id uuid) returns uuid language plpgsql security definer set search_path='' as $$declare v_session public.stock_count_sessions%rowtype; v_line record; v_current numeric; begin
 if auth.uid() is null then raise exception 'authentication required'; end if; select * into v_session from public.stock_count_sessions where id=p_session_id for update; if not found then raise exception 'stock count session not found'; end if; if not app_private.has_permission('inventory.count',v_session.branch_id,auth.uid()) then raise exception 'permission denied'; end if;
 if v_session.status='pending_approval' then insert into public.approval_requests(branch_id,request_type,stock_count_session_id,requested_by) values(v_session.branch_id,'stock_count_variance',v_session.id,coalesce(v_session.submitted_by,auth.uid())) on conflict(request_type,stock_count_session_id) do nothing; return v_session.id; end if;
 if v_session.status<>'draft' then raise exception 'stock count is not submittable'; end if; if not exists(select 1 from public.stock_count_lines l where l.session_id=v_session.id) then raise exception 'stock count requires at least one line'; end if;
 for v_line in select * from public.stock_count_lines l where l.session_id=v_session.id order by l.id loop v_current:=app_private.current_stock_quantity(v_session.branch_id,v_session.warehouse_id,v_line.inventory_item_id); if v_current<>v_line.system_quantity then raise exception 'stock changed after count snapshot; recount item %',v_line.inventory_item_id; end if; end loop;
 update public.stock_count_sessions set status='pending_approval',submitted_at=now(),submitted_by=auth.uid(),updated_at=now() where id=v_session.id;
 insert into public.approval_requests(branch_id,request_type,stock_count_session_id,requested_by) values(v_session.branch_id,'stock_count_variance',v_session.id,auth.uid()) on conflict(request_type,stock_count_session_id) do nothing; return v_session.id; end$$;

insert into public.approval_requests(branch_id,request_type,stock_count_session_id,requested_by,requested_at)
select s.branch_id,'stock_count_variance',s.id,coalesce(s.submitted_by,s.created_by),coalesce(s.submitted_at,s.created_at) from public.stock_count_sessions s where s.status='pending_approval'
on conflict(request_type,stock_count_session_id) do nothing;

create or replace function app_private.review_stock_count_approval_internal(p_request_id uuid,p_decision text,p_reason text default null) returns uuid language plpgsql security definer set search_path='' as $$declare v_request public.approval_requests%rowtype; v_session public.stock_count_sessions%rowtype; v_line record; v_current numeric; v_movement uuid; v_key text; begin
 if auth.uid() is null then raise exception 'authentication required'; end if; select * into v_request from public.approval_requests where id=p_request_id for update; if not found then raise exception 'approval request not found'; end if; if not app_private.has_permission('approvals.review',v_request.branch_id,auth.uid()) then raise exception 'permission denied'; end if; if v_request.requested_by=auth.uid() and not app_private.has_permission('approvals.self_review',v_request.branch_id,auth.uid()) then raise exception 'self approval is not allowed'; end if; if p_decision not in('approve','reject') then raise exception 'invalid approval decision'; end if; if p_decision='reject' and nullif(btrim(p_reason),'') is null then raise exception 'rejection reason required'; end if; if v_request.status<>'pending' then return v_request.id; end if;
 select * into v_session from public.stock_count_sessions where id=v_request.stock_count_session_id for update; if not found or v_session.branch_id<>v_request.branch_id then raise exception 'stock count session not found'; end if; if v_session.status<>'pending_approval' then raise exception 'stock count is not awaiting approval'; end if;
 if p_decision='reject' then update public.approval_requests set status='rejected',reviewed_by=auth.uid(),reviewed_at=now(),review_reason=nullif(btrim(p_reason),'') where id=v_request.id; update public.stock_count_sessions set status='rejected',updated_at=now() where id=v_session.id; return v_request.id; end if;
 for v_line in select * from public.stock_count_lines l where l.session_id=v_session.id order by l.id for update loop
  perform pg_advisory_xact_lock(hashtextextended(v_session.warehouse_id::text||':'||v_line.inventory_item_id::text,0)); v_current:=app_private.current_stock_quantity(v_session.branch_id,v_session.warehouse_id,v_line.inventory_item_id); if v_current<>v_line.system_quantity then raise exception 'stock changed after submitted count; approval aborted for item %',v_line.inventory_item_id; end if;
  if v_line.variance_quantity<>0 then v_key:='approved-count:'||v_session.id::text||':line:'||v_line.id::text; select sm.id into v_movement from public.stock_movements sm where sm.branch_id=v_session.branch_id and sm.idempotency_key=v_key; if v_movement is null then insert into public.stock_movements(branch_id,warehouse_id,inventory_item_id,movement_type,quantity_delta,reference_type,reference_id,idempotency_key,note,created_by) values(v_session.branch_id,v_session.warehouse_id,v_line.inventory_item_id,'count_adjustment',v_line.variance_quantity,'stock_count_session',v_session.id,v_key,coalesce(nullif(btrim(p_reason),''),'Approved stock count variance'),auth.uid()) returning id into v_movement; end if; update public.stock_count_lines set stock_movement_id=v_movement,updated_at=now() where id=v_line.id; end if;
 end loop;
 update public.approval_requests set status='approved',reviewed_by=auth.uid(),reviewed_at=now(),review_reason=nullif(btrim(p_reason),'') where id=v_request.id; update public.stock_count_sessions set status='posted',updated_at=now() where id=v_session.id; return v_request.id; end$$;
create or replace function public.review_stock_count_approval(p_request_id uuid,p_decision text,p_reason text default null) returns uuid language sql security invoker set search_path='' as $$select app_private.review_stock_count_approval_internal(p_request_id,p_decision,p_reason)$$;
revoke all on function app_private.review_stock_count_approval_internal(uuid,text,text) from public,anon,authenticated;
revoke all on function public.review_stock_count_approval(uuid,text,text) from public,anon;
grant execute on function public.review_stock_count_approval(uuid,text,text) to authenticated;
