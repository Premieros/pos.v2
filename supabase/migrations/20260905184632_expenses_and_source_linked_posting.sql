insert into public.permissions(key,module,description)
values
 ('accounting.expenses.view','accounting','View branch expense documents'),
 ('accounting.expenses.create','accounting','Create branch expense documents'),
 ('accounting.expenses.edit','accounting','Edit draft expense documents'),
 ('accounting.expenses.post','accounting','Post expense documents to accounting')
on conflict (key) do nothing;

create table public.expense_documents (
 id uuid primary key default gen_random_uuid(),
 branch_id uuid not null references public.branches(id),
 expense_number bigint not null,
 expense_date date not null default current_date,
 status text not null default 'draft' check (status in ('draft','posted','reversed')),
 amount numeric(14,2) not null check (amount > 0),
 expense_account_id uuid not null,
 offset_account_id uuid not null,
 payee text,
 description text not null check (btrim(description) <> ''),
 reference text,
 idempotency_key text not null check (btrim(idempotency_key) <> ''),
 journal_entry_id uuid,
 posted_at timestamptz,
 posted_by uuid references auth.users(id),
 created_by uuid not null default auth.uid() references auth.users(id),
 updated_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(branch_id,expense_number),
 unique(branch_id,idempotency_key),
 unique(id,branch_id),
 foreign key(expense_account_id,branch_id) references public.accounts(id,branch_id),
 foreign key(offset_account_id,branch_id) references public.accounts(id,branch_id),
 foreign key(journal_entry_id,branch_id) references public.journal_entries(id,branch_id),
 check (expense_account_id <> offset_account_id)
);

create index idx_expense_documents_branch_date on public.expense_documents(branch_id,expense_date desc,expense_number desc);
create index idx_expense_documents_branch_status on public.expense_documents(branch_id,status,expense_date desc);
create index idx_expense_documents_expense_account on public.expense_documents(expense_account_id,branch_id);
create index idx_expense_documents_offset_account on public.expense_documents(offset_account_id,branch_id);
create index idx_expense_documents_journal on public.expense_documents(journal_entry_id,branch_id) where journal_entry_id is not null;
create index idx_expense_documents_created_by on public.expense_documents(created_by);
create index idx_expense_documents_updated_by on public.expense_documents(updated_by);
create index idx_expense_documents_posted_by on public.expense_documents(posted_by) where posted_by is not null;

alter table public.expense_documents enable row level security;
create policy expense_documents_select on public.expense_documents for select to authenticated using (
 app_private.current_user_may_access_branch(branch_id) and (
   app_private.current_user_has_permission('accounting.expenses.view',branch_id)
   or app_private.current_user_has_permission('accounting.expenses.create',branch_id)
   or app_private.current_user_has_permission('accounting.expenses.edit',branch_id)
   or app_private.current_user_has_permission('accounting.expenses.post',branch_id)
 )
);
revoke all on public.expense_documents from anon,authenticated;
grant select on public.expense_documents to authenticated;

drop policy if exists accounts_select on public.accounts;
create policy accounts_select on public.accounts for select to authenticated using (
 app_private.current_user_may_access_branch(branch_id) and (
   app_private.current_user_has_permission('accounting.coa.view',branch_id)
   or app_private.current_user_has_permission('accounting.coa.manage',branch_id)
   or app_private.current_user_has_permission('accounting.journals.view',branch_id)
   or app_private.current_user_has_permission('accounting.journals.create',branch_id)
   or app_private.current_user_has_permission('accounting.journals.edit',branch_id)
   or app_private.current_user_has_permission('accounting.journals.post',branch_id)
   or app_private.current_user_has_permission('accounting.expenses.view',branch_id)
   or app_private.current_user_has_permission('accounting.expenses.create',branch_id)
   or app_private.current_user_has_permission('accounting.expenses.edit',branch_id)
   or app_private.current_user_has_permission('accounting.expenses.post',branch_id)
 )
);

create or replace function app_private.validate_expense_accounts_internal(p_branch_id uuid,p_expense_account_id uuid,p_offset_account_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_expense public.accounts%rowtype; v_offset public.accounts%rowtype;
begin
 if p_expense_account_id=p_offset_account_id then raise exception 'expense and offset accounts must differ'; end if;
 select * into v_expense from public.accounts where id=p_expense_account_id and branch_id=p_branch_id;
 if not found or not v_expense.is_active or not v_expense.is_postable or v_expense.account_type<>'expense' then raise exception 'expense account must be active postable expense account'; end if;
 select * into v_offset from public.accounts where id=p_offset_account_id and branch_id=p_branch_id;
 if not found or not v_offset.is_active or not v_offset.is_postable then raise exception 'offset account must be active and postable'; end if;
end $$;

create or replace function app_private.create_expense_document_internal(
 p_branch_id uuid,p_expense_date date,p_amount numeric,p_expense_account_id uuid,p_offset_account_id uuid,p_payee text,p_description text,p_reference text,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_number bigint;
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 if not app_private.has_permission('accounting.expenses.create',p_branch_id,auth.uid()) then raise exception 'permission denied'; end if;
 if coalesce(p_amount,0)<=0 then raise exception 'expense amount must be positive'; end if;
 if nullif(btrim(p_description),'') is null then raise exception 'expense description required'; end if;
 if nullif(btrim(p_idempotency_key),'') is null then raise exception 'idempotency key required'; end if;
 perform app_private.validate_expense_accounts_internal(p_branch_id,p_expense_account_id,p_offset_account_id);
 select id into v_id from public.expense_documents where branch_id=p_branch_id and idempotency_key=btrim(p_idempotency_key);
 if found then return v_id; end if;
 perform pg_advisory_xact_lock(hashtextextended('expense:'||p_branch_id::text,0));
 select coalesce(max(expense_number),0)+1 into v_number from public.expense_documents where branch_id=p_branch_id;
 insert into public.expense_documents(branch_id,expense_number,expense_date,amount,expense_account_id,offset_account_id,payee,description,reference,idempotency_key,created_by,updated_by)
 values(p_branch_id,v_number,coalesce(p_expense_date,current_date),round(p_amount,2),p_expense_account_id,p_offset_account_id,nullif(btrim(p_payee),''),btrim(p_description),nullif(btrim(p_reference),''),btrim(p_idempotency_key),auth.uid(),auth.uid()) returning id into v_id;
 return v_id;
end $$;

create or replace function public.create_expense_document(
 p_branch_id uuid,p_expense_date date,p_amount numeric,p_expense_account_id uuid,p_offset_account_id uuid,p_payee text,p_description text,p_reference text,p_idempotency_key text
) returns uuid language sql security invoker set search_path='' as $$
 select app_private.create_expense_document_internal(p_branch_id,p_expense_date,p_amount,p_expense_account_id,p_offset_account_id,p_payee,p_description,p_reference,p_idempotency_key)
$$;

create or replace function app_private.update_expense_document_internal(
 p_expense_id uuid,p_expense_date date,p_amount numeric,p_expense_account_id uuid,p_offset_account_id uuid,p_payee text,p_description text,p_reference text
) returns void language plpgsql security definer set search_path='' as $$
declare v_expense public.expense_documents%rowtype;
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 select * into v_expense from public.expense_documents where id=p_expense_id for update;
 if not found then raise exception 'expense document not found'; end if;
 if not app_private.has_permission('accounting.expenses.edit',v_expense.branch_id,auth.uid()) then raise exception 'permission denied'; end if;
 if v_expense.status<>'draft' then raise exception 'only draft expense can be edited'; end if;
 if coalesce(p_amount,0)<=0 then raise exception 'expense amount must be positive'; end if;
 if nullif(btrim(p_description),'') is null then raise exception 'expense description required'; end if;
 perform app_private.validate_expense_accounts_internal(v_expense.branch_id,p_expense_account_id,p_offset_account_id);
 update public.expense_documents set expense_date=coalesce(p_expense_date,current_date),amount=round(p_amount,2),expense_account_id=p_expense_account_id,offset_account_id=p_offset_account_id,payee=nullif(btrim(p_payee),''),description=btrim(p_description),reference=nullif(btrim(p_reference),''),updated_by=auth.uid(),updated_at=now() where id=v_expense.id;
end $$;

create or replace function public.update_expense_document(
 p_expense_id uuid,p_expense_date date,p_amount numeric,p_expense_account_id uuid,p_offset_account_id uuid,p_payee text,p_description text,p_reference text
) returns void language sql security invoker set search_path='' as $$
 select app_private.update_expense_document_internal(p_expense_id,p_expense_date,p_amount,p_expense_account_id,p_offset_account_id,p_payee,p_description,p_reference)
$$;

create or replace function app_private.post_expense_document_internal(p_expense_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_expense public.expense_documents%rowtype; v_journal_id uuid; v_journal_number bigint;
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 select * into v_expense from public.expense_documents where id=p_expense_id for update;
 if not found then raise exception 'expense document not found'; end if;
 if not app_private.has_permission('accounting.expenses.post',v_expense.branch_id,auth.uid()) then raise exception 'permission denied'; end if;
 if v_expense.status='posted' then return v_expense.journal_entry_id; end if;
 if v_expense.status<>'draft' then raise exception 'expense is not postable'; end if;
 perform app_private.validate_expense_accounts_internal(v_expense.branch_id,v_expense.expense_account_id,v_expense.offset_account_id);
 perform pg_advisory_xact_lock(hashtextextended('journal:'||v_expense.branch_id::text,0));
 select coalesce(max(entry_number),0)+1 into v_journal_number from public.journal_entries where branch_id=v_expense.branch_id;
 insert into public.journal_entries(branch_id,entry_number,entry_date,status,memo,reference,idempotency_key,source_type,source_id,posted_at,posted_by,created_by,updated_by)
 values(v_expense.branch_id,v_journal_number,v_expense.expense_date,'posted',v_expense.description,v_expense.reference,'expense:'||v_expense.id::text,'expense',v_expense.id,now(),auth.uid(),auth.uid(),auth.uid()) returning id into v_journal_id;
 insert into public.journal_lines(branch_id,journal_entry_id,line_no,account_id,debit,credit,description)
 values
  (v_expense.branch_id,v_journal_id,1,v_expense.expense_account_id,v_expense.amount,0,v_expense.description),
  (v_expense.branch_id,v_journal_id,2,v_expense.offset_account_id,0,v_expense.amount,coalesce(v_expense.payee,v_expense.description));
 update public.expense_documents set status='posted',journal_entry_id=v_journal_id,posted_at=now(),posted_by=auth.uid(),updated_by=auth.uid(),updated_at=now() where id=v_expense.id;
 return v_journal_id;
end $$;

create or replace function public.post_expense_document(p_expense_id uuid)
returns uuid language sql security invoker set search_path='' as $$
 select app_private.post_expense_document_internal(p_expense_id)
$$;

revoke all on function app_private.validate_expense_accounts_internal(uuid,uuid,uuid),app_private.create_expense_document_internal(uuid,date,numeric,uuid,uuid,text,text,text,text),app_private.update_expense_document_internal(uuid,date,numeric,uuid,uuid,text,text,text),app_private.post_expense_document_internal(uuid) from public,anon,authenticated;
revoke all on function public.create_expense_document(uuid,date,numeric,uuid,uuid,text,text,text,text),public.update_expense_document(uuid,date,numeric,uuid,uuid,text,text,text),public.post_expense_document(uuid) from public,anon;
grant execute on function public.create_expense_document(uuid,date,numeric,uuid,uuid,text,text,text,text),public.update_expense_document(uuid,date,numeric,uuid,uuid,text,text,text),public.post_expense_document(uuid) to authenticated;
