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
  join public.journal_lines jl on jl.account_id=a.id and jl.branch_id=a.branch_id
  join public.journal_entries je on je.id=jl.journal_entry_id and je.branch_id=jl.branch_id
  where a.branch_id=p_branch_id and a.is_postable and je.status='posted' and je.entry_date between p_from_date and p_to_date
  group by a.id,a.code,a.name_ar,a.name_en,a.account_type
  having coalesce(sum(jl.debit),0)<>0 or coalesce(sum(jl.credit),0)<>0
  order by a.code;
end $$;

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

  select coalesce(sum(jl.credit-jl.debit),0)
  into v_current_earnings
  from public.accounts a
  join public.journal_lines jl on jl.account_id=a.id and jl.branch_id=a.branch_id
  join public.journal_entries je on je.id=jl.journal_entry_id and je.branch_id=jl.branch_id
  where a.branch_id=p_branch_id and a.account_type in ('revenue','expense') and je.status='posted' and je.entry_date<=p_as_of;

  if v_current_earnings<>0 then
    account_id:=null; code:='CURRENT_EARNINGS'; name_ar:='أرباح الفترة المتراكمة'; account_type:='equity'; amount:=v_current_earnings; is_synthetic:=true;
    return next;
  end if;
end $$;
