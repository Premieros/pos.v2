create unique index uq_treasury_accounts_branch_account on public.treasury_accounts(branch_id,account_id);

create or replace function app_private.create_treasury_movement_internal(
 p_branch_id uuid,p_treasury_account_id uuid,p_movement_date date,p_direction text,p_amount numeric,p_counter_account_id uuid,p_description text,p_reference text,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_treasury public.treasury_accounts%rowtype; v_counter public.accounts%rowtype; v_id uuid; v_number bigint; v_journal_id uuid; v_journal_number bigint; v_balance numeric(14,2);
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 if not app_private.has_permission('treasury.movements.create',p_branch_id,auth.uid()) then raise exception 'permission denied'; end if;
 if p_direction not in ('in','out') then raise exception 'invalid treasury movement direction'; end if;
 if coalesce(p_amount,0)<=0 then raise exception 'treasury movement amount must be positive'; end if;
 if nullif(btrim(p_description),'') is null then raise exception 'treasury movement description required'; end if;
 if nullif(btrim(p_idempotency_key),'') is null then raise exception 'idempotency key required'; end if;

 select id into v_id from public.treasury_movements where branch_id=p_branch_id and idempotency_key=btrim(p_idempotency_key);
 if found then return v_id; end if;

 select * into v_treasury from public.treasury_accounts where id=p_treasury_account_id and branch_id=p_branch_id for update;
 if not found or not v_treasury.is_active then raise exception 'active treasury account not found in branch'; end if;
 perform app_private.validate_treasury_coa_account_internal(p_branch_id,v_treasury.account_id);

 select * into v_counter from public.accounts where id=p_counter_account_id and branch_id=p_branch_id;
 if not found or not v_counter.is_active or not v_counter.is_postable then raise exception 'counter account must be active and postable'; end if;
 if v_counter.id=v_treasury.account_id then raise exception 'counter account must differ from treasury COA account'; end if;

 if p_direction='out' then
   select coalesce(balance,0) into v_balance from public.treasury_balances where branch_id=p_branch_id and treasury_account_id=p_treasury_account_id;
   if coalesce(v_balance,0) < round(p_amount,2) then raise exception 'insufficient treasury balance'; end if;
 end if;

 perform pg_advisory_xact_lock(hashtextextended('treasury:'||p_branch_id::text,0));
 select coalesce(max(movement_number),0)+1 into v_number from public.treasury_movements where branch_id=p_branch_id;
 perform pg_advisory_xact_lock(hashtextextended('journal:'||p_branch_id::text,0));
 select coalesce(max(entry_number),0)+1 into v_journal_number from public.journal_entries where branch_id=p_branch_id;

 insert into public.journal_entries(branch_id,entry_number,entry_date,status,memo,reference,idempotency_key,source_type,source_id,posted_at,posted_by,created_by,updated_by)
 values(p_branch_id,v_journal_number,coalesce(p_movement_date,current_date),'posted',btrim(p_description),nullif(btrim(p_reference),''),'treasury:'||btrim(p_idempotency_key),'treasury_movement',null,now(),auth.uid(),auth.uid(),auth.uid()) returning id into v_journal_id;

 insert into public.journal_lines(branch_id,journal_entry_id,line_no,account_id,debit,credit,description)
 values
 (p_branch_id,v_journal_id,1,case when p_direction='in' then v_treasury.account_id else v_counter.id end,round(p_amount,2),0,btrim(p_description)),
 (p_branch_id,v_journal_id,2,case when p_direction='in' then v_counter.id else v_treasury.account_id end,0,round(p_amount,2),btrim(p_description));

 insert into public.treasury_movements(branch_id,treasury_account_id,movement_number,movement_date,direction,amount,counter_account_id,description,reference,idempotency_key,journal_entry_id,created_by)
 values(p_branch_id,p_treasury_account_id,v_number,coalesce(p_movement_date,current_date),p_direction,round(p_amount,2),p_counter_account_id,btrim(p_description),nullif(btrim(p_reference),''),btrim(p_idempotency_key),v_journal_id,auth.uid()) returning id into v_id;

 update public.journal_entries set source_id=v_id where id=v_journal_id;
 return v_id;
end $$;

revoke all on function app_private.create_treasury_movement_internal(uuid,uuid,date,text,numeric,uuid,text,text,text) from public,anon,authenticated;
