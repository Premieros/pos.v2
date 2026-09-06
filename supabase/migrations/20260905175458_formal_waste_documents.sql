-- Applied to locked Supabase project scpovyrqmsbiduanykod.
-- Formal waste documents: branch/warehouse scoped, SELECT-only tables, RPC-only mutation.
-- Posting writes the existing stock_movements ledger atomically using inventory.waste.

create table public.waste_documents (
 id uuid primary key default gen_random_uuid(), branch_id uuid not null references public.branches(id), warehouse_id uuid not null,
 status text not null default 'draft' check(status in('draft','posted','cancelled')), reason text not null check(btrim(reason)<>''), note text,
 posted_at timestamptz, posted_by uuid references auth.users(id), created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,branch_id),
 foreign key(warehouse_id,branch_id) references public.warehouses(id,branch_id));
create table public.waste_document_lines (
 id uuid primary key default gen_random_uuid(), branch_id uuid not null references public.branches(id), waste_document_id uuid not null,
 inventory_item_id uuid not null, quantity numeric not null check(quantity>0), note text, stock_movement_id uuid references public.stock_movements(id),
 created_at timestamptz not null default now(), unique(id,branch_id), foreign key(waste_document_id,branch_id) references public.waste_documents(id,branch_id) on delete cascade,
 foreign key(inventory_item_id,branch_id) references public.inventory_items(id,branch_id), unique(waste_document_id,inventory_item_id));
create index idx_waste_documents_branch_status on public.waste_documents(branch_id,status,created_at desc);
create index idx_waste_documents_warehouse_branch on public.waste_documents(warehouse_id,branch_id);
create index idx_waste_documents_created_by on public.waste_documents(created_by);
create index idx_waste_documents_posted_by on public.waste_documents(posted_by) where posted_by is not null;
create index idx_waste_document_lines_document_branch on public.waste_document_lines(waste_document_id,branch_id);
create index idx_waste_document_lines_item_branch on public.waste_document_lines(inventory_item_id,branch_id);
create index idx_waste_document_lines_movement on public.waste_document_lines(stock_movement_id) where stock_movement_id is not null;
create index idx_waste_document_lines_branch on public.waste_document_lines(branch_id);
alter table public.waste_documents enable row level security; alter table public.waste_document_lines enable row level security;
create policy waste_documents_select on public.waste_documents for select to authenticated using(app_private.has_permission('inventory.waste',branch_id,auth.uid()));
create policy waste_document_lines_select on public.waste_document_lines for select to authenticated using(app_private.has_permission('inventory.waste',branch_id,auth.uid()));
revoke all on public.waste_documents,public.waste_document_lines from anon,authenticated; grant select on public.waste_documents,public.waste_document_lines to authenticated;

create or replace function app_private.create_waste_document_internal(p_branch_id uuid,p_warehouse_id uuid,p_reason text,p_note text default null) returns uuid language plpgsql security definer set search_path='' as $$ declare v_id uuid; begin
 if auth.uid() is null then raise exception 'authentication required'; end if; if not app_private.has_permission('inventory.waste',p_branch_id,auth.uid()) then raise exception 'permission denied'; end if;
 if nullif(btrim(p_reason),'') is null then raise exception 'waste reason required'; end if; perform 1 from public.warehouses w where w.id=p_warehouse_id and w.branch_id=p_branch_id and w.is_active; if not found then raise exception 'active warehouse not found in branch'; end if;
 insert into public.waste_documents(branch_id,warehouse_id,reason,note,created_by) values(p_branch_id,p_warehouse_id,btrim(p_reason),nullif(btrim(p_note),''),auth.uid()) returning id into v_id; return v_id; end $$;
create or replace function public.create_waste_document(p_branch_id uuid,p_warehouse_id uuid,p_reason text,p_note text default null) returns uuid language sql security invoker set search_path='' as $$select app_private.create_waste_document_internal(p_branch_id,p_warehouse_id,p_reason,p_note)$$;
create or replace function app_private.add_waste_document_line_internal(p_document_id uuid,p_inventory_item_id uuid,p_quantity numeric,p_note text default null) returns uuid language plpgsql security definer set search_path='' as $$ declare v_doc public.waste_documents%rowtype; v_id uuid; begin
 if auth.uid() is null then raise exception 'authentication required'; end if; select * into v_doc from public.waste_documents where id=p_document_id for update; if not found then raise exception 'waste document not found'; end if;
 if not app_private.has_permission('inventory.waste',v_doc.branch_id,auth.uid()) then raise exception 'permission denied'; end if; if v_doc.status<>'draft' then raise exception 'only draft waste document can be edited'; end if; if p_quantity is null or p_quantity<=0 then raise exception 'waste quantity must be positive'; end if;
 perform 1 from public.inventory_items i where i.id=p_inventory_item_id and i.branch_id=v_doc.branch_id and i.is_active; if not found then raise exception 'active inventory item not found in branch'; end if;
 insert into public.waste_document_lines(branch_id,waste_document_id,inventory_item_id,quantity,note) values(v_doc.branch_id,v_doc.id,p_inventory_item_id,p_quantity,nullif(btrim(p_note),'')) returning id into v_id; return v_id; end $$;
create or replace function public.add_waste_document_line(p_document_id uuid,p_inventory_item_id uuid,p_quantity numeric,p_note text default null) returns uuid language sql security invoker set search_path='' as $$select app_private.add_waste_document_line_internal(p_document_id,p_inventory_item_id,p_quantity,p_note)$$;
create or replace function app_private.post_waste_document_internal(p_document_id uuid) returns uuid language plpgsql security definer set search_path='' as $$ declare v_doc public.waste_documents%rowtype; v_line record; v_movement uuid; begin
 if auth.uid() is null then raise exception 'authentication required'; end if; select * into v_doc from public.waste_documents where id=p_document_id for update; if not found then raise exception 'waste document not found'; end if;
 if not app_private.has_permission('inventory.waste',v_doc.branch_id,auth.uid()) then raise exception 'permission denied'; end if; if v_doc.status='posted' then return v_doc.id; end if; if v_doc.status<>'draft' then raise exception 'waste document is not postable'; end if;
 if not exists(select 1 from public.waste_document_lines l where l.waste_document_id=v_doc.id) then raise exception 'waste document requires at least one line'; end if;
 for v_line in select * from public.waste_document_lines l where l.waste_document_id=v_doc.id order by l.id for update loop
  v_movement:=app_private.record_stock_movement(v_doc.branch_id,v_doc.warehouse_id,v_line.inventory_item_id,'waste',-v_line.quantity,'waste-document:'||v_doc.id::text||':line:'||v_line.id::text,coalesce(v_line.note,v_doc.reason),'waste_document',v_doc.id);
  update public.waste_document_lines set stock_movement_id=v_movement where id=v_line.id; end loop;
 update public.waste_documents set status='posted',posted_at=now(),posted_by=auth.uid(),updated_at=now() where id=v_doc.id; return v_doc.id; end $$;
create or replace function public.post_waste_document(p_document_id uuid) returns uuid language sql security invoker set search_path='' as $$select app_private.post_waste_document_internal(p_document_id)$$;
revoke all on function app_private.create_waste_document_internal(uuid,uuid,text,text),app_private.add_waste_document_line_internal(uuid,uuid,numeric,text),app_private.post_waste_document_internal(uuid) from public,anon,authenticated;
revoke all on function public.create_waste_document(uuid,uuid,text,text),public.add_waste_document_line(uuid,uuid,numeric,text),public.post_waste_document(uuid) from public,anon;
grant execute on function public.create_waste_document(uuid,uuid,text,text),public.add_waste_document_line(uuid,uuid,numeric,text),public.post_waste_document(uuid) to authenticated;
