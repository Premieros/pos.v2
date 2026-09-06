insert into public.permissions(key,module,description)
values ('accounting.journals.reverse','accounting','Reverse posted journal entries')
on conflict (key) do nothing;

create table if not exists public.journal_reversals (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  original_journal_entry_id uuid not null,
  reversal_journal_entry_id uuid not null,
  reason text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(original_journal_entry_id),
  unique(reversal_journal_entry_id),
  constraint journal_reversals_original_branch_fk foreign key(original_journal_entry_id,branch_id) references public.journal_entries(id,branch_id),
  constraint journal_reversals_reversal_branch_fk foreign key(reversal_journal_entry_id,branch_id) references public.journal_entries(id,branch_id),
  constraint journal_reversals_reason_chk check (length(btrim(reason)) > 0)
);

create index if not exists idx_journal_reversals_branch_created on public.journal_reversals(branch_id,created_at desc);
create index if not exists idx_journal_reversals_created_by on public.journal_reversals(created_by);

alter table public.journal_reversals enable row level security;
revoke all on public.journal_reversals from anon, authenticated;
grant select on public.journal_reversals to authenticated;

drop policy if exists journal_reversals_select on public.journal_reversals;
create policy journal_reversals_select on public.journal_reversals
for select to authenticated
using (
  app_private.current_user_may_access_branch(branch_id)
  and (
    app_private.current_user_has_permission('accounting.journals.view',branch_id)
    or app_private.current_user_has_permission('accounting.journals.reverse',branch_id)
  )
);

create or replace function app_private.reverse_journal_entry_internal(
  p_journal_entry_id uuid,
  p_reason text
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_original public.journal_entries%rowtype;
  v_existing uuid;
  v_reversal uuid;
  v_num bigint;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'authentication required'; end if;
  if p_reason is null or length(btrim(p_reason))=0 then raise exception 'reversal reason is required'; end if;

  select * into v_original
  from public.journal_entries
  where id=p_journal_entry_id
  for update;
  if not found then raise exception 'journal entry not found'; end if;

  if not app_private.current_user_has_permission('accounting.journals.reverse',v_original.branch_id) then
    raise exception 'permission denied';
  end if;
  if v_original.status <> 'posted' then raise exception 'only posted journals can be reversed'; end if;

  select reversal_journal_entry_id into v_existing
  from public.journal_reversals
  where original_journal_entry_id=v_original.id;
  if found then return v_existing; end if;

  if exists(select 1 from public.journal_reversals where reversal_journal_entry_id=v_original.id) then
    raise exception 'reversal journals cannot be reversed in this phase';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('journal:'||v_original.branch_id::text,0));
  select coalesce(max(entry_number),0)+1 into v_num
  from public.journal_entries where branch_id=v_original.branch_id;

  insert into public.journal_entries(
    branch_id,entry_number,entry_date,status,memo,reference,idempotency_key,
    source_type,source_id,posted_at,posted_by,created_by,updated_by
  ) values (
    v_original.branch_id,v_num,current_date,'posted',
    'Reversal of journal #'||v_original.entry_number::text||': '||btrim(p_reason),
    v_original.reference,
    'reversal:'||v_original.id::text,
    'journal_reversal',v_original.id,now(),v_actor,v_actor,v_actor
  ) returning id into v_reversal;

  insert into public.journal_lines(branch_id,journal_entry_id,line_no,account_id,debit,credit,description)
  select branch_id,v_reversal,line_no,account_id,credit,debit,
         coalesce(description,'') || case when description is null or description='' then '' else ' — ' end || 'Reversal'
  from public.journal_lines
  where journal_entry_id=v_original.id
  order by line_no;

  if not exists(select 1 from public.journal_lines where journal_entry_id=v_reversal) then
    raise exception 'journal has no lines';
  end if;

  insert into public.journal_reversals(branch_id,original_journal_entry_id,reversal_journal_entry_id,reason,created_by)
  values(v_original.branch_id,v_original.id,v_reversal,btrim(p_reason),v_actor);

  return v_reversal;
end $$;

revoke all on function app_private.reverse_journal_entry_internal(uuid,text) from public, anon, authenticated;

create or replace function public.reverse_journal_entry(p_journal_entry_id uuid,p_reason text)
returns uuid
language sql
security invoker
set search_path=''
as $$ select app_private.reverse_journal_entry_internal(p_journal_entry_id,p_reason) $$;
revoke all on function public.reverse_journal_entry(uuid,text) from public, anon;
grant execute on function public.reverse_journal_entry(uuid,text) to authenticated;

create or replace function app_private.try_post_refund_accounting_internal(p_refund_id uuid)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  r public.refunds%rowtype;
  m public.accounting_posting_mappings%rowtype;
  s public.accounting_source_postings%rowtype;
  v_journal uuid;
  v_num bigint;
  v_account uuid;
  v_actor uuid;
begin
  select * into r from public.refunds where id=p_refund_id;
  if not found then return null; end if;
  v_actor := coalesce(auth.uid(),r.created_by);

  insert into public.accounting_source_postings(branch_id,source_type,source_id)
  values(r.branch_id,'refund',r.id)
  on conflict(branch_id,source_type,source_id) do nothing;

  select * into s from public.accounting_source_postings
  where branch_id=r.branch_id and source_type='refund' and source_id=r.id
  for update;
  if s.status='posted' then return s.journal_entry_id; end if;

  select * into m from public.accounting_posting_mappings where branch_id=r.branch_id;
  if not found or m.sales_revenue_account_id is null or
     (r.method='cash' and m.sales_cash_account_id is null) or
     (r.method='card' and m.sales_card_account_id is null) then
    update public.accounting_source_postings set status='pending_configuration',last_error='refund accounting mapping is incomplete',updated_at=now() where id=s.id;
    return null;
  end if;

  perform app_private.validate_posting_mapping_account(r.branch_id,m.sales_revenue_account_id,'revenue');
  v_account := case when r.method='cash' then m.sales_cash_account_id else m.sales_card_account_id end;
  perform app_private.validate_posting_mapping_account(r.branch_id,v_account,'asset');

  perform pg_advisory_xact_lock(hashtextextended('journal:'||r.branch_id::text,0));
  select coalesce(max(entry_number),0)+1 into v_num from public.journal_entries where branch_id=r.branch_id;

  insert into public.journal_entries(branch_id,entry_number,entry_date,status,memo,reference,idempotency_key,source_type,source_id,posted_at,posted_by,created_by,updated_by)
  values(r.branch_id,v_num,r.created_at::date,'posted','POS refund',null,'source:refund:'||r.id::text,'refund',r.id,now(),v_actor,v_actor,v_actor)
  returning id into v_journal;

  insert into public.journal_lines(branch_id,journal_entry_id,line_no,account_id,debit,credit,description)
  values
    (r.branch_id,v_journal,1,m.sales_revenue_account_id,r.amount,0,'Sales refund'),
    (r.branch_id,v_journal,2,v_account,0,r.amount,case when r.method='cash' then 'Cash refund' else 'Card refund' end);

  update public.accounting_source_postings set status='posted',journal_entry_id=v_journal,last_error=null,posted_at=now(),updated_at=now() where id=s.id;
  return v_journal;
exception when others then
  update public.accounting_source_postings
  set status='error',last_error=sqlerrm,updated_at=now()
  where branch_id=(select branch_id from public.refunds where id=p_refund_id)
    and source_type='refund' and source_id=p_refund_id;
  return null;
end $$;

revoke all on function app_private.try_post_refund_accounting_internal(uuid) from public, anon, authenticated;

create or replace function app_private.refund_accounting_trigger()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  perform app_private.try_post_refund_accounting_internal(new.id);
  return new;
end $$;
revoke all on function app_private.refund_accounting_trigger() from public, anon, authenticated;

drop trigger if exists trg_refund_accounting_post on public.refunds;
create trigger trg_refund_accounting_post
after insert on public.refunds
for each row execute function app_private.refund_accounting_trigger();
