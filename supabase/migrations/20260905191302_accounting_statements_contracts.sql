insert into public.permissions(key,module,description)
values ('accounting.statements.view','accounting','View accounting statements')
on conflict (key) do nothing;

create or replace function app_private.assert_statement_access(p_branch_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not app_private.current_user_may_access_branch(p_branch_id) then raise exception 'branch access denied'; end if;
  if not app_private.current_user_has_permission('accounting.statements.view',p_branch_id) then raise exception 'permission denied'; end if;
end $$;
revoke all on function app_private.assert_statement_access(uuid) from public, anon, authenticated;

create or replace function app_private.get_trial_balance_internal(
  p_branch_id uuid,
  p_from_date date,
  p_to_date date
) returns table(
  account_id uuid,
  code text,
  name_ar text,
  name_en text,
  account_type text,
  total_debit numeric,
  total_credit numeric,
  balance numeric
)
language plpgsql
security definer
set search_path=''
as $$
begin
  perform app_private.assert_statement_access(p_branch_id);
  if p_from_date is null or p_to_date is null or p_from_date>p_to_date then raise exception 'invalid statement date range'; end if;
  return query
  select a.id,a.code,a.name_ar,a.name_en,a.account_type,
         coalesce(sum(jl.debit),0)::numeric,
         coalesce(sum(jl.credit),0)::numeric,
         (coalesce(sum(jl.debit),0)-coalesce(sum(jl.credit),0))::numeric
  from public.accounts a
  left join public.journal_lines jl on jl.account_id=a.id and jl.branch_id=a.branch_id
  left join public.journal_entries je on je.id=jl.journal_entry_id and je.branch_id=jl.branch_id
       and je.status='posted' and je.entry_date between p_from_date and p_to_date
  where a.branch_id=p_branch_id and a.is_postable
  group by a.id,a.code,a.name_ar,a.name_en,a.account_type
  having coalesce(sum(case when je.id is not null then jl.debit else 0 end),0)<>0
      or coalesce(sum(case when je.id is not null then jl.credit else 0 end),0)<>0
  order by a.code;
end $$;
revoke all on function app_private.get_trial_balance_internal(uuid,date,date) from public, anon, authenticated;

create or replace function public.get_trial_balance(p_branch_id uuid,p_from_date date,p_to_date date)
returns table(account_id uuid,code text,name_ar text,name_en text,account_type text,total_debit numeric,total_credit numeric,balance numeric)
language sql
security invoker
set search_path=''
as $$ select * from app_private.get_trial_balance_internal(p_branch_id,p_from_date,p_to_date) $$;
revoke all on function public.get_trial_balance(uuid,date,date) from public, anon;
grant execute on function public.get_trial_balance(uuid,date,date) to authenticated;

create or replace function app_private.get_general_ledger_internal(
  p_branch_id uuid,
  p_account_id uuid,
  p_from_date date,
  p_to_date date
) returns table(
  entry_date date,
  entry_number bigint,
  journal_entry_id uuid,
  memo text,
  reference text,
  debit numeric,
  credit numeric,
  running_balance numeric
)
language plpgsql
security definer
set search_path=''
as $$
declare v_opening numeric:=0;
begin
  perform app_private.assert_statement_access(p_branch_id);
  if p_from_date is null or p_to_date is null or p_from_date>p_to_date then raise exception 'invalid statement date range'; end if;
  if not exists(select 1 from public.accounts where id=p_account_id and branch_id=p_branch_id) then raise exception 'account not found'; end if;

  select coalesce(sum(jl.debit-jl.credit),0) into v_opening
  from public.journal_lines jl join public.journal_entries je on je.id=jl.journal_entry_id and je.branch_id=jl.branch_id
  where jl.branch_id=p_branch_id and jl.account_id=p_account_id and je.status='posted' and je.entry_date<p_from_date;

  return query
  select q.entry_date,q.entry_number,q.journal_entry_id,q.memo,q.reference,q.debit,q.credit,
         (v_opening + sum(q.debit-q.credit) over(order by q.entry_date,q.entry_number,q.line_no rows unbounded preceding))::numeric
  from (
    select je.entry_date,je.entry_number,je.id as journal_entry_id,je.memo,je.reference,jl.debit,jl.credit,jl.line_no
    from public.journal_lines jl join public.journal_entries je on je.id=jl.journal_entry_id and je.branch_id=jl.branch_id
    where jl.branch_id=p_branch_id and jl.account_id=p_account_id and je.status='posted' and je.entry_date between p_from_date and p_to_date
  ) q
  order by q.entry_date,q.entry_number,q.line_no;
end $$;
revoke all on function app_private.get_general_ledger_internal(uuid,uuid,date,date) from public, anon, authenticated;

create or replace function public.get_general_ledger(p_branch_id uuid,p_account_id uuid,p_from_date date,p_to_date date)
returns table(entry_date date,entry_number bigint,journal_entry_id uuid,memo text,reference text,debit numeric,credit numeric,running_balance numeric)
language sql
security invoker
set search_path=''
as $$ select * from app_private.get_general_ledger_internal(p_branch_id,p_account_id,p_from_date,p_to_date) $$;
revoke all on function public.get_general_ledger(uuid,uuid,date,date) from public, anon;
grant execute on function public.get_general_ledger(uuid,uuid,date,date) to authenticated;

create or replace function app_private.get_income_statement_internal(
  p_branch_id uuid,
  p_from_date date,
  p_to_date date
) returns table(
  account_id uuid,
  code text,
  name_ar text,
  account_type text,
  amount numeric
)
language plpgsql
security definer
set search_path=''
as $$
begin
  perform app_private.assert_statement_access(p_branch_id);
  if p_from_date is null or p_to_date is null or p_from_date>p_to_date then raise exception 'invalid statement date range'; end if;
  return query
  select a.id,a.code,a.name_ar,a.account_type,
         case when a.account_type='revenue'
              then (coalesce(sum(jl.credit),0)-coalesce(sum(jl.debit),0))::numeric
              else (coalesce(sum(jl.debit),0)-coalesce(sum(jl.credit),0))::numeric end as amount
  from public.accounts a
  join public.journal_lines jl on jl.account_id=a.id and jl.branch_id=a.branch_id
  join public.journal_entries je on je.id=jl.journal_entry_id and je.branch_id=jl.branch_id
  where a.branch_id=p_branch_id and a.account_type in ('revenue','expense') and je.status='posted' and je.entry_date between p_from_date and p_to_date
  group by a.id,a.code,a.name_ar,a.account_type
  having coalesce(sum(jl.debit),0)<>0 or coalesce(sum(jl.credit),0)<>0
  order by a.account_type desc,a.code;
end $$;
revoke all on function app_private.get_income_statement_internal(uuid,date,date) from public, anon, authenticated;

create or replace function public.get_income_statement(p_branch_id uuid,p_from_date date,p_to_date date)
returns table(account_id uuid,code text,name_ar text,account_type text,amount numeric)
language sql
security invoker
set search_path=''
as $$ select * from app_private.get_income_statement_internal(p_branch_id,p_from_date,p_to_date) $$;
revoke all on function public.get_income_statement(uuid,date,date) from public, anon;
grant execute on function public.get_income_statement(uuid,date,date) to authenticated;

create or replace function app_private.get_balance_sheet_internal(
  p_branch_id uuid,
  p_as_of date
) returns table(
  account_id uuid,
  code text,
  name_ar text,
  account_type text,
  amount numeric,
  is_synthetic boolean
)
language plpgsql
security definer
set search_path=''
as $$
declare v_current_earnings numeric:=0;
begin
  perform app_private.assert_statement_access(p_branch_id);
  if p_as_of is null then raise exception 'statement date is required'; end if;

  return query
  select a.id,a.code,a.name_ar,a.account_type,
         case when a.account_type='asset'
              then (coalesce(sum(jl.debit),0)-coalesce(sum(jl.credit),0))::numeric
              else (coalesce(sum(jl.credit),0)-coalesce(sum(jl.debit),0))::numeric end as amount,
         false
  from public.accounts a
  join public.journal_lines jl on jl.account_id=a.id and jl.branch_id=a.branch_id
  join public.journal_entries je on je.id=jl.journal_entry_id and je.branch_id=jl.branch_id
  where a.branch_id=p_branch_id and a.account_type in ('asset','liability','equity') and je.status='posted' and je.entry_date<=p_as_of
  group by a.id,a.code,a.name_ar,a.account_type
  having coalesce(sum(jl.debit),0)<>0 or coalesce(sum(jl.credit),0)<>0
  order by a.account_type,a.code;

  select coalesce(sum(case when a.account_type='revenue' then jl.credit-jl.debit else jl.debit-jl.credit end),0)
  into v_current_earnings
  from public.accounts a join public.journal_lines jl on jl.account_id=a.id and jl.branch_id=a.branch_id
  join public.journal_entries je on je.id=jl.journal_entry_id and je.branch_id=jl.branch_id
  where a.branch_id=p_branch_id and a.account_type in ('revenue','expense') and je.status='posted' and je.entry_date<=p_as_of;

  if v_current_earnings<>0 then
    account_id:=null; code:='CURRENT_EARNINGS'; name_ar:='أرباح الفترة المتراكمة'; account_type:='equity'; amount:=v_current_earnings; is_synthetic:=true;
    return next;
  end if;
end $$;
revoke all on function app_private.get_balance_sheet_internal(uuid,date) from public, anon, authenticated;

create or replace function public.get_balance_sheet(p_branch_id uuid,p_as_of date)
returns table(account_id uuid,code text,name_ar text,account_type text,amount numeric,is_synthetic boolean)
language sql
security invoker
set search_path=''
as $$ select * from app_private.get_balance_sheet_internal(p_branch_id,p_as_of) $$;
revoke all on function public.get_balance_sheet(uuid,date) from public, anon;
grant execute on function public.get_balance_sheet(uuid,date) to authenticated;
