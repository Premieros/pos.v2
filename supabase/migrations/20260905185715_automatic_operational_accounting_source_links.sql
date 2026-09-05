insert into public.permissions(key,module,description)
values
 ('accounting.posting.view','accounting','View operational accounting source posting status'),
 ('accounting.posting.manage','accounting','Configure operational accounting mappings'),
 ('accounting.posting.retry','accounting','Retry pending operational accounting postings')
on conflict (key) do nothing;

create table public.accounting_posting_mappings (
 branch_id uuid primary key references public.branches(id),
 sales_revenue_account_id uuid,
 sales_cash_account_id uuid,
 sales_card_account_id uuid,
 purchase_inventory_account_id uuid,
 purchase_payable_account_id uuid,
 updated_by uuid not null default auth.uid() references auth.users(id),
 updated_at timestamptz not null default now(),
 foreign key(sales_revenue_account_id,branch_id) references public.accounts(id,branch_id),
 foreign key(sales_cash_account_id,branch_id) references public.accounts(id,branch_id),
 foreign key(sales_card_account_id,branch_id) references public.accounts(id,branch_id),
 foreign key(purchase_inventory_account_id,branch_id) references public.accounts(id,branch_id),
 foreign key(purchase_payable_account_id,branch_id) references public.accounts(id,branch_id)
);

create table public.accounting_source_postings (
 id uuid primary key default gen_random_uuid(),
 branch_id uuid not null references public.branches(id),
 source_type text not null check(source_type in('pos_order','purchase_receipt')),
 source_id uuid not null,
 status text not null default 'pending_configuration' check(status in('pending_configuration','pending_data','posted','error')),
 journal_entry_id uuid,
 last_error text,
 posted_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(branch_id,source_type,source_id),
 foreign key(journal_entry_id,branch_id) references public.journal_entries(id,branch_id)
);

create index idx_accounting_source_postings_branch_status on public.accounting_source_postings(branch_id,status,updated_at desc);
create index idx_accounting_source_postings_journal_branch on public.accounting_source_postings(journal_entry_id,branch_id) where journal_entry_id is not null;
create index idx_accounting_posting_mappings_updated_by on public.accounting_posting_mappings(updated_by);

alter table public.accounting_posting_mappings enable row level security;
alter table public.accounting_source_postings enable row level security;
create policy accounting_posting_mappings_select on public.accounting_posting_mappings for select to authenticated using(app_private.current_user_may_access_branch(branch_id) and (app_private.current_user_has_permission('accounting.posting.view',branch_id) or app_private.current_user_has_permission('accounting.posting.manage',branch_id) or app_private.current_user_has_permission('accounting.posting.retry',branch_id)));
create policy accounting_source_postings_select on public.accounting_source_postings for select to authenticated using(app_private.current_user_may_access_branch(branch_id) and (app_private.current_user_has_permission('accounting.posting.view',branch_id) or app_private.current_user_has_permission('accounting.posting.manage',branch_id) or app_private.current_user_has_permission('accounting.posting.retry',branch_id)));
revoke all on public.accounting_posting_mappings,public.accounting_source_postings from anon,authenticated;
grant select on public.accounting_posting_mappings,public.accounting_source_postings to authenticated;

drop policy if exists accounts_select on public.accounts;
create policy accounts_select on public.accounts for select to authenticated using(app_private.current_user_may_access_branch(branch_id) and (
 app_private.current_user_has_permission('accounting.coa.view',branch_id) or app_private.current_user_has_permission('accounting.coa.manage',branch_id)
 or app_private.current_user_has_permission('accounting.journals.view',branch_id) or app_private.current_user_has_permission('accounting.journals.create',branch_id) or app_private.current_user_has_permission('accounting.journals.edit',branch_id) or app_private.current_user_has_permission('accounting.journals.post',branch_id)
 or app_private.current_user_has_permission('accounting.expenses.view',branch_id) or app_private.current_user_has_permission('accounting.expenses.create',branch_id) or app_private.current_user_has_permission('accounting.expenses.edit',branch_id) or app_private.current_user_has_permission('accounting.expenses.post',branch_id)
 or app_private.current_user_has_permission('treasury.view',branch_id) or app_private.current_user_has_permission('treasury.accounts.manage',branch_id) or app_private.current_user_has_permission('treasury.movements.create',branch_id)
 or app_private.current_user_has_permission('accounting.posting.view',branch_id) or app_private.current_user_has_permission('accounting.posting.manage',branch_id) or app_private.current_user_has_permission('accounting.posting.retry',branch_id)));

create or replace function app_private.validate_posting_mapping_account(p_branch_id uuid,p_account_id uuid,p_expected_type text)
returns void language plpgsql security definer set search_path='' as $$
declare v public.accounts%rowtype; begin
 if p_account_id is null then return; end if;
 select * into v from public.accounts where id=p_account_id and branch_id=p_branch_id;
 if not found or not v.is_active or not v.is_postable then raise exception 'mapping account must be active and postable'; end if;
 if p_expected_type is not null and v.account_type<>p_expected_type then raise exception 'mapping account type mismatch'; end if;
end $$;

create or replace function app_private.set_accounting_posting_mappings_internal(p_branch_id uuid,p_sales_revenue uuid,p_sales_cash uuid,p_sales_card uuid,p_purchase_inventory uuid,p_purchase_payable uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 if not app_private.has_permission('accounting.posting.manage',p_branch_id,auth.uid()) then raise exception 'permission denied'; end if;
 perform app_private.validate_posting_mapping_account(p_branch_id,p_sales_revenue,'revenue');
 perform app_private.validate_posting_mapping_account(p_branch_id,p_sales_cash,'asset');
 perform app_private.validate_posting_mapping_account(p_branch_id,p_sales_card,'asset');
 perform app_private.validate_posting_mapping_account(p_branch_id,p_purchase_inventory,'asset');
 perform app_private.validate_posting_mapping_account(p_branch_id,p_purchase_payable,'liability');
 insert into public.accounting_posting_mappings(branch_id,sales_revenue_account_id,sales_cash_account_id,sales_card_account_id,purchase_inventory_account_id,purchase_payable_account_id,updated_by,updated_at)
 values(p_branch_id,p_sales_revenue,p_sales_cash,p_sales_card,p_purchase_inventory,p_purchase_payable,auth.uid(),now())
 on conflict(branch_id) do update set sales_revenue_account_id=excluded.sales_revenue_account_id,sales_cash_account_id=excluded.sales_cash_account_id,sales_card_account_id=excluded.sales_card_account_id,purchase_inventory_account_id=excluded.purchase_inventory_account_id,purchase_payable_account_id=excluded.purchase_payable_account_id,updated_by=auth.uid(),updated_at=now();
end $$;
create or replace function public.set_accounting_posting_mappings(p_branch_id uuid,p_sales_revenue uuid,p_sales_cash uuid,p_sales_card uuid,p_purchase_inventory uuid,p_purchase_payable uuid)
returns void language sql security invoker set search_path='' as $$select app_private.set_accounting_posting_mappings_internal(p_branch_id,p_sales_revenue,p_sales_cash,p_sales_card,p_purchase_inventory,p_purchase_payable)$$;

create or replace function app_private.try_post_accounting_source_internal(p_branch_id uuid,p_source_type text,p_source_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare m public.accounting_posting_mappings%rowtype; s public.accounting_source_postings%rowtype; v_journal uuid; v_num bigint; v_total numeric(14,2); v_cash numeric(14,2); v_card numeric(14,2); v_order public.orders%rowtype; v_receipt public.purchase_receipts%rowtype; v_line_no int:=0;
begin
 insert into public.accounting_source_postings(branch_id,source_type,source_id) values(p_branch_id,p_source_type,p_source_id) on conflict(branch_id,source_type,source_id) do nothing;
 select * into s from public.accounting_source_postings where branch_id=p_branch_id and source_type=p_source_type and source_id=p_source_id for update;
 if s.status='posted' then return s.journal_entry_id; end if;
 select * into m from public.accounting_posting_mappings where branch_id=p_branch_id;
 if not found then update public.accounting_source_postings set status='pending_configuration',last_error='accounting mapping is not configured',updated_at=now() where id=s.id; return null; end if;

 if p_source_type='pos_order' then
   if m.sales_revenue_account_id is null or m.sales_cash_account_id is null or m.sales_card_account_id is null then update public.accounting_source_postings set status='pending_configuration',last_error='sales accounting mapping is incomplete',updated_at=now() where id=s.id; return null; end if;
   select * into v_order from public.orders where id=p_source_id and branch_id=p_branch_id;
   if not found or v_order.status not in ('paid','closed','returned') then update public.accounting_source_postings set status='pending_data',last_error='order is not financially completed',updated_at=now() where id=s.id; return null; end if;
   select coalesce(round(sum(case when p.method='cash' and p.status='completed' then pa.amount else 0 end),2),0),coalesce(round(sum(case when p.method='card' and p.status='completed' then pa.amount else 0 end),2),0) into v_cash,v_card from public.payment_allocations pa join public.payments p on p.id=pa.payment_id and p.branch_id=pa.branch_id where pa.order_id=v_order.id and pa.branch_id=p_branch_id;
   v_total:=round(v_cash+v_card,2);
   if v_total<=0 or v_total<>round(v_order.total,2) then update public.accounting_source_postings set status='pending_data',last_error='completed payment composition does not match order total',updated_at=now() where id=s.id; return null; end if;
   perform app_private.validate_posting_mapping_account(p_branch_id,m.sales_revenue_account_id,'revenue'); perform app_private.validate_posting_mapping_account(p_branch_id,m.sales_cash_account_id,'asset'); perform app_private.validate_posting_mapping_account(p_branch_id,m.sales_card_account_id,'asset');
   perform pg_advisory_xact_lock(hashtextextended('journal:'||p_branch_id::text,0)); select coalesce(max(entry_number),0)+1 into v_num from public.journal_entries where branch_id=p_branch_id;
   insert into public.journal_entries(branch_id,entry_number,entry_date,status,memo,reference,idempotency_key,source_type,source_id,posted_at,posted_by,created_by,updated_by) values(p_branch_id,v_num,v_order.created_at::date,'posted','POS sale #'||v_order.order_number::text,null,'source:pos_order:'||v_order.id::text,'pos_order',v_order.id,now(),coalesce(auth.uid(),v_order.created_by),coalesce(auth.uid(),v_order.created_by),coalesce(auth.uid(),v_order.created_by)) returning id into v_journal;
   if v_cash>0 then v_line_no:=v_line_no+1; insert into public.journal_lines(branch_id,journal_entry_id,line_no,account_id,debit,credit,description) values(p_branch_id,v_journal,v_line_no,m.sales_cash_account_id,v_cash,0,'Cash sales receipts'); end if;
   if v_card>0 then v_line_no:=v_line_no+1; insert into public.journal_lines(branch_id,journal_entry_id,line_no,account_id,debit,credit,description) values(p_branch_id,v_journal,v_line_no,m.sales_card_account_id,v_card,0,'Card sales receipts'); end if;
   v_line_no:=v_line_no+1; insert into public.journal_lines(branch_id,journal_entry_id,line_no,account_id,debit,credit,description) values(p_branch_id,v_journal,v_line_no,m.sales_revenue_account_id,0,v_total,'POS sales revenue');
 elsif p_source_type='purchase_receipt' then
   if m.purchase_inventory_account_id is null or m.purchase_payable_account_id is null then update public.accounting_source_postings set status='pending_configuration',last_error='purchase accounting mapping is incomplete',updated_at=now() where id=s.id; return null; end if;
   select * into v_receipt from public.purchase_receipts where id=p_source_id and branch_id=p_branch_id;
   if not found then update public.accounting_source_postings set status='pending_data',last_error='purchase receipt not found',updated_at=now() where id=s.id; return null; end if;
   select coalesce(round(sum(quantity*unit_cost),2),0) into v_total from public.purchase_receipt_lines where purchase_receipt_id=v_receipt.id and branch_id=p_branch_id;
   if v_total<=0 then update public.accounting_source_postings set status='pending_data',last_error='purchase receipt has no accepted value',updated_at=now() where id=s.id; return null; end if;
   perform app_private.validate_posting_mapping_account(p_branch_id,m.purchase_inventory_account_id,'asset'); perform app_private.validate_posting_mapping_account(p_branch_id,m.purchase_payable_account_id,'liability');
   perform pg_advisory_xact_lock(hashtextextended('journal:'||p_branch_id::text,0)); select coalesce(max(entry_number),0)+1 into v_num from public.journal_entries where branch_id=p_branch_id;
   insert into public.journal_entries(branch_id,entry_number,entry_date,status,memo,reference,idempotency_key,source_type,source_id,posted_at,posted_by,created_by,updated_by) values(p_branch_id,v_num,v_receipt.created_at::date,'posted','Purchase receipt',null,'source:purchase_receipt:'||v_receipt.id::text,'purchase_receipt',v_receipt.id,now(),coalesce(auth.uid(),v_receipt.created_by),coalesce(auth.uid(),v_receipt.created_by),coalesce(auth.uid(),v_receipt.created_by)) returning id into v_journal;
   insert into public.journal_lines(branch_id,journal_entry_id,line_no,account_id,debit,credit,description) values(p_branch_id,v_journal,1,m.purchase_inventory_account_id,v_total,0,'Inventory received'),(p_branch_id,v_journal,2,m.purchase_payable_account_id,0,v_total,'Purchase payable');
 else raise exception 'unsupported accounting source type'; end if;
 update public.accounting_source_postings set status='posted',journal_entry_id=v_journal,last_error=null,posted_at=now(),updated_at=now() where id=s.id;
 return v_journal;
exception when others then
 update public.accounting_source_postings set status='error',last_error=sqlerrm,updated_at=now() where branch_id=p_branch_id and source_type=p_source_type and source_id=p_source_id;
 return null;
end $$;

create or replace function app_private.queue_order_accounting_source_trigger() returns trigger language plpgsql security definer set search_path='' as $$begin if new.status in ('paid','closed') and old.status is distinct from new.status then perform app_private.try_post_accounting_source_internal(new.branch_id,'pos_order',new.id); end if; return new; end $$;
create trigger trg_queue_order_accounting_source after update of status on public.orders for each row execute function app_private.queue_order_accounting_source_trigger();
create or replace function app_private.queue_purchase_receipt_accounting_source_trigger() returns trigger language plpgsql security definer set search_path='' as $$begin perform app_private.try_post_accounting_source_internal(new.branch_id,'purchase_receipt',new.id); return new; end $$;
create trigger trg_queue_purchase_receipt_accounting_source after insert on public.purchase_receipts for each row execute function app_private.queue_purchase_receipt_accounting_source_trigger();

insert into public.accounting_source_postings(branch_id,source_type,source_id,status,last_error)
select branch_id,'pos_order',id,'pending_configuration','backfilled source awaiting accounting mapping' from public.orders where status in('paid','closed') on conflict do nothing;
insert into public.accounting_source_postings(branch_id,source_type,source_id,status,last_error)
select branch_id,'purchase_receipt',id,'pending_configuration','backfilled source awaiting accounting mapping' from public.purchase_receipts on conflict do nothing;

create or replace function app_private.retry_accounting_source_internal(p_posting_id uuid) returns uuid language plpgsql security definer set search_path='' as $$declare s public.accounting_source_postings%rowtype; begin if auth.uid() is null then raise exception 'authentication required'; end if; select * into s from public.accounting_source_postings where id=p_posting_id; if not found then raise exception 'accounting source posting not found'; end if; if not app_private.has_permission('accounting.posting.retry',s.branch_id,auth.uid()) then raise exception 'permission denied'; end if; return app_private.try_post_accounting_source_internal(s.branch_id,s.source_type,s.source_id); end $$;
create or replace function public.retry_accounting_source(p_posting_id uuid) returns uuid language sql security invoker set search_path='' as $$select app_private.retry_accounting_source_internal(p_posting_id)$$;

revoke all on function app_private.validate_posting_mapping_account(uuid,uuid,text),app_private.set_accounting_posting_mappings_internal(uuid,uuid,uuid,uuid,uuid,uuid),app_private.try_post_accounting_source_internal(uuid,text,uuid),app_private.retry_accounting_source_internal(uuid),app_private.queue_order_accounting_source_trigger(),app_private.queue_purchase_receipt_accounting_source_trigger() from public,anon,authenticated;
revoke all on function public.set_accounting_posting_mappings(uuid,uuid,uuid,uuid,uuid,uuid),public.retry_accounting_source(uuid) from public,anon;
grant execute on function public.set_accounting_posting_mappings(uuid,uuid,uuid,uuid,uuid,uuid),public.retry_accounting_source(uuid) to authenticated;
