alter function app_private.try_post_accounting_source_internal(uuid,text,uuid) rename to perform_accounting_source_post_internal;

create or replace function app_private.try_post_accounting_source_internal(p_branch_id uuid,p_source_type text,p_source_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_posting public.accounting_source_postings%rowtype;
  v_order_status text;
  v_result uuid;
begin
  insert into public.accounting_source_postings(branch_id,source_type,source_id)
  values(p_branch_id,p_source_type,p_source_id)
  on conflict(branch_id,source_type,source_id) do nothing;

  select * into v_posting
  from public.accounting_source_postings
  where branch_id=p_branch_id and source_type=p_source_type and source_id=p_source_id
  for update;

  if v_posting.status='posted' then
    return v_posting.journal_entry_id;
  end if;

  if p_source_type='pos_order' then
    select status into v_order_status from public.orders where id=p_source_id and branch_id=p_branch_id;
    if v_order_status='returned' then
      update public.accounting_source_postings
      set status='pending_data',last_error='returned order accounting is handled by reversal/refund flow',updated_at=now()
      where id=v_posting.id;
      return null;
    end if;
  end if;

  begin
    v_result := app_private.perform_accounting_source_post_internal(p_branch_id,p_source_type,p_source_id);
    return v_result;
  exception when others then
    update public.accounting_source_postings
    set status='error',last_error=sqlerrm,updated_at=now()
    where id=v_posting.id;
    return null;
  end;
end $$;

revoke all on function app_private.perform_accounting_source_post_internal(uuid,text,uuid) from public,anon,authenticated;
revoke all on function app_private.try_post_accounting_source_internal(uuid,text,uuid) from public,anon,authenticated;
