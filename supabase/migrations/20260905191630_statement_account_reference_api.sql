create or replace function app_private.get_statement_accounts_internal(p_branch_id uuid)
returns table(id uuid,code text,name_ar text,name_en text,account_type text)
language plpgsql
security definer
set search_path=''
as $$
begin
  perform app_private.assert_statement_access(p_branch_id);
  return query
  select a.id,a.code,a.name_ar,a.name_en,a.account_type
  from public.accounts a
  where a.branch_id=p_branch_id and a.is_postable and a.is_active
  order by a.code;
end $$;
revoke all on function app_private.get_statement_accounts_internal(uuid) from public, anon, authenticated;

create or replace function public.get_statement_accounts(p_branch_id uuid)
returns table(id uuid,code text,name_ar text,name_en text,account_type text)
language sql
security invoker
set search_path=''
as $$ select * from app_private.get_statement_accounts_internal(p_branch_id) $$;
revoke all on function public.get_statement_accounts(uuid) from public, anon;
grant execute on function public.get_statement_accounts(uuid) to authenticated;
