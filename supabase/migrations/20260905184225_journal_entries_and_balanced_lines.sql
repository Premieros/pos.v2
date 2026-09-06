insert into public.permissions(key,module,description)
values
 ('accounting.journals.view','accounting','View branch journal entries'),
 ('accounting.journals.create','accounting','Create branch journal entries'),
 ('accounting.journals.edit','accounting','Edit draft journal entries and lines'),
 ('accounting.journals.post','accounting','Post balanced journal entries')
on conflict (key) do nothing;

create table public.journal_entries (
 id uuid primary key default gen_random_uuid(),
 branch_id uuid not null references public.branches(id),
 entry_number bigint not null,
 entry_date date not null default current_date,
 status text not null default 'draft' check (status in ('draft','posted','reversed')),
 memo text,
 reference text,
 idempotency_key text not null check (btrim(idempotency_key) <> ''),
 source_type text,
 source_id uuid,
 posted_at timestamptz,
 posted_by uuid references auth.users(id),
 created_by uuid not null default auth.uid() references auth.users(id),
 updated_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(branch_id,entry_number),
 unique(branch_id,idempotency_key),
 unique(id,branch_id)
);

create table public.journal_lines (
 id uuid primary key default gen_random_uuid(),
 branch_id uuid not null references public.branches(id),
 journal_entry_id uuid not null,
 line_no integer not null check (line_no > 0),
 account_id uuid not null,
 debit numeric(14,2) not null default 0 check (debit >= 0),
 credit numeric(14,2) not null default 0 check (credit >= 0),
 description text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(journal_entry_id,line_no),
 unique(id,branch_id),
 foreign key(journal_entry_id,branch_id) references public.journal_entries(id,branch_id) on delete cascade,
 foreign key(account_id,branch_id) references public.accounts(id,branch_id),
 check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0))
);

create index idx_journal_entries_branch_date on public.journal_entries(branch_id,entry_date desc,entry_number desc);
create index idx_journal_entries_branch_status on public.journal_entries(branch_id,status,entry_date desc);
create index idx_journal_entries_created_by on public.journal_entries(created_by);
create index idx_journal_entries_updated_by on public.journal_entries(updated_by);
create index idx_journal_entries_posted_by on public.journal_entries(posted_by) where posted_by is not null;
create index idx_journal_lines_entry_branch on public.journal_lines(journal_entry_id,branch_id);
create index idx_journal_lines_account_branch on public.journal_lines(account_id,branch_id);
create index idx_journal_lines_branch on public.journal_lines(branch_id);

alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;

create policy journal_entries_select on public.journal_entries for select to authenticated using (
 app_private.current_user_may_access_branch(branch_id) and (
  app_private.current_user_has_permission('accounting.journals.view',branch_id)
  or app_private.current_user_has_permission('accounting.journals.create',branch_id)
  or app_private.current_user_has_permission('accounting.journals.edit',branch_id)
  or app_private.current_user_has_permission('accounting.journals.post',branch_id)
 )
);
create policy journal_lines_select on public.journal_lines for select to authenticated using (
 app_private.current_user_may_access_branch(branch_id) and (
  app_private.current_user_has_permission('accounting.journals.view',branch_id)
  or app_private.current_user_has_permission('accounting.journals.create',branch_id)
  or app_private.current_user_has_permission('accounting.journals.edit',branch_id)
  or app_private.current_user_has_permission('accounting.journals.post',branch_id)
 )
);

revoke all on public.journal_entries,public.journal_lines from anon,authenticated;
grant select on public.journal_entries,public.journal_lines to authenticated;

drop policy if exists accounts_select on public.accounts;
create policy accounts_select on public.accounts for select to authenticated using (
 app_private.current_user_may_access_branch(branch_id) and (
   app_private.current_user_has_permission('accounting.coa.view',branch_id)
   or app_private.current_user_has_permission('accounting.coa.manage',branch_id)
   or app_private.current_user_has_permission('accounting.journals.view',branch_id)
   or app_private.current_user_has_permission('accounting.journals.create',branch_id)
   or app_private.current_user_has_permission('accounting.journals.edit',branch_id)
   or app_private.current_user_has_permission('accounting.journals.post',branch_id)
 )
);

create or replace function app_private.create_journal_entry_internal(
 p_branch_id uuid,p_entry_date date,p_memo text,p_reference text,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_number bigint;
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 if not app_private.has_permission('accounting.journals.create',p_branch_id,auth.uid()) then raise exception 'permission denied'; end if;
 if nullif(btrim(p_idempotency_key),'') is null then raise exception 'idempotency key required'; end if;
 select id into v_id from public.journal_entries where branch_id=p_branch_id and idempotency_key=btrim(p_idempotency_key);
 if found then return v_id; end if;
 perform pg_advisory_xact_lock(hashtextextended('journal:'||p_branch_id::text,0));
 select coalesce(max(entry_number),0)+1 into v_number from public.journal_entries where branch_id=p_branch_id;
 insert into public.journal_entries(branch_id,entry_number,entry_date,memo,reference,idempotency_key,created_by,updated_by)
 values(p_branch_id,v_number,coalesce(p_entry_date,current_date),nullif(btrim(p_memo),''),nullif(btrim(p_reference),''),btrim(p_idempotency_key),auth.uid(),auth.uid()) returning id into v_id;
 return v_id;
end $$;

create or replace function public.create_journal_entry(
 p_branch_id uuid,p_entry_date date,p_memo text,p_reference text,p_idempotency_key text
) returns uuid language sql security invoker set search_path='' as $$
 select app_private.create_journal_entry_internal(p_branch_id,p_entry_date,p_memo,p_reference,p_idempotency_key)
$$;

create or replace function app_private.add_journal_line_internal(
 p_journal_entry_id uuid,p_account_id uuid,p_debit numeric,p_credit numeric,p_description text default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_entry public.journal_entries%rowtype; v_account public.accounts%rowtype; v_id uuid; v_line_no integer;
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 select * into v_entry from public.journal_entries where id=p_journal_entry_id for update;
 if not found then raise exception 'journal entry not found'; end if;
 if not app_private.has_permission('accounting.journals.edit',v_entry.branch_id,auth.uid()) then raise exception 'permission denied'; end if;
 if v_entry.status <> 'draft' then raise exception 'only draft journal can be edited'; end if;
 if not ((coalesce(p_debit,0)>0 and coalesce(p_credit,0)=0) or (coalesce(p_credit,0)>0 and coalesce(p_debit,0)=0)) then raise exception 'journal line must contain debit or credit, not both'; end if;
 select * into v_account from public.accounts where id=p_account_id and branch_id=v_entry.branch_id;
 if not found then raise exception 'account not found in journal branch'; end if;
 if not v_account.is_active or not v_account.is_postable then raise exception 'journal account must be active and postable'; end if;
 select coalesce(max(line_no),0)+1 into v_line_no from public.journal_lines where journal_entry_id=v_entry.id;
 insert into public.journal_lines(branch_id,journal_entry_id,line_no,account_id,debit,credit,description)
 values(v_entry.branch_id,v_entry.id,v_line_no,p_account_id,round(coalesce(p_debit,0),2),round(coalesce(p_credit,0),2),nullif(btrim(p_description),'')) returning id into v_id;
 update public.journal_entries set updated_by=auth.uid(),updated_at=now() where id=v_entry.id;
 return v_id;
end $$;

create or replace function public.add_journal_line(
 p_journal_entry_id uuid,p_account_id uuid,p_debit numeric,p_credit numeric,p_description text default null
) returns uuid language sql security invoker set search_path='' as $$
 select app_private.add_journal_line_internal(p_journal_entry_id,p_account_id,p_debit,p_credit,p_description)
$$;

create or replace function app_private.update_journal_line_internal(
 p_journal_line_id uuid,p_account_id uuid,p_debit numeric,p_credit numeric,p_description text default null
) returns void language plpgsql security definer set search_path='' as $$
declare v_line public.journal_lines%rowtype; v_entry public.journal_entries%rowtype; v_account public.accounts%rowtype;
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 select * into v_line from public.journal_lines where id=p_journal_line_id for update;
 if not found then raise exception 'journal line not found'; end if;
 select * into v_entry from public.journal_entries where id=v_line.journal_entry_id for update;
 if not app_private.has_permission('accounting.journals.edit',v_entry.branch_id,auth.uid()) then raise exception 'permission denied'; end if;
 if v_entry.status <> 'draft' then raise exception 'only draft journal can be edited'; end if;
 if not ((coalesce(p_debit,0)>0 and coalesce(p_credit,0)=0) or (coalesce(p_credit,0)>0 and coalesce(p_debit,0)=0)) then raise exception 'journal line must contain debit or credit, not both'; end if;
 select * into v_account from public.accounts where id=p_account_id and branch_id=v_entry.branch_id;
 if not found or not v_account.is_active or not v_account.is_postable then raise exception 'journal account must be active and postable'; end if;
 update public.journal_lines set account_id=p_account_id,debit=round(coalesce(p_debit,0),2),credit=round(coalesce(p_credit,0),2),description=nullif(btrim(p_description),''),updated_at=now() where id=v_line.id;
 update public.journal_entries set updated_by=auth.uid(),updated_at=now() where id=v_entry.id;
end $$;

create or replace function public.update_journal_line(
 p_journal_line_id uuid,p_account_id uuid,p_debit numeric,p_credit numeric,p_description text default null
) returns void language sql security invoker set search_path='' as $$
 select app_private.update_journal_line_internal(p_journal_line_id,p_account_id,p_debit,p_credit,p_description)
$$;

create or replace function app_private.remove_journal_line_internal(p_journal_line_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_line public.journal_lines%rowtype; v_entry public.journal_entries%rowtype;
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 select * into v_line from public.journal_lines where id=p_journal_line_id for update;
 if not found then raise exception 'journal line not found'; end if;
 select * into v_entry from public.journal_entries where id=v_line.journal_entry_id for update;
 if not app_private.has_permission('accounting.journals.edit',v_entry.branch_id,auth.uid()) then raise exception 'permission denied'; end if;
 if v_entry.status <> 'draft' then raise exception 'only draft journal can be edited'; end if;
 delete from public.journal_lines where id=v_line.id;
 update public.journal_entries set updated_by=auth.uid(),updated_at=now() where id=v_entry.id;
end $$;

create or replace function public.remove_journal_line(p_journal_line_id uuid)
returns void language sql security invoker set search_path='' as $$
 select app_private.remove_journal_line_internal(p_journal_line_id)
$$;

create or replace function app_private.post_journal_entry_internal(p_journal_entry_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_entry public.journal_entries%rowtype; v_debit numeric(14,2); v_credit numeric(14,2); v_count integer;
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 select * into v_entry from public.journal_entries where id=p_journal_entry_id for update;
 if not found then raise exception 'journal entry not found'; end if;
 if not app_private.has_permission('accounting.journals.post',v_entry.branch_id,auth.uid()) then raise exception 'permission denied'; end if;
 if v_entry.status='posted' then return v_entry.id; end if;
 if v_entry.status <> 'draft' then raise exception 'journal entry is not postable'; end if;
 select count(*),coalesce(round(sum(debit),2),0),coalesce(round(sum(credit),2),0) into v_count,v_debit,v_credit from public.journal_lines where journal_entry_id=v_entry.id;
 if v_count < 2 then raise exception 'journal entry requires at least two lines'; end if;
 if v_debit <= 0 or v_credit <= 0 or v_debit <> v_credit then raise exception 'journal entry is not balanced'; end if;
 if exists(select 1 from public.journal_lines l join public.accounts a on a.id=l.account_id and a.branch_id=l.branch_id where l.journal_entry_id=v_entry.id and (not a.is_active or not a.is_postable)) then raise exception 'journal contains inactive or non-postable account'; end if;
 update public.journal_entries set status='posted',posted_at=now(),posted_by=auth.uid(),updated_by=auth.uid(),updated_at=now() where id=v_entry.id;
 return v_entry.id;
end $$;

create or replace function public.post_journal_entry(p_journal_entry_id uuid)
returns uuid language sql security invoker set search_path='' as $$
 select app_private.post_journal_entry_internal(p_journal_entry_id)
$$;

revoke all on function app_private.create_journal_entry_internal(uuid,date,text,text,text),app_private.add_journal_line_internal(uuid,uuid,numeric,numeric,text),app_private.update_journal_line_internal(uuid,uuid,numeric,numeric,text),app_private.remove_journal_line_internal(uuid),app_private.post_journal_entry_internal(uuid) from public,anon,authenticated;
revoke all on function public.create_journal_entry(uuid,date,text,text,text),public.add_journal_line(uuid,uuid,numeric,numeric,text),public.update_journal_line(uuid,uuid,numeric,numeric,text),public.remove_journal_line(uuid),public.post_journal_entry(uuid) from public,anon;
grant execute on function public.create_journal_entry(uuid,date,text,text,text),public.add_journal_line(uuid,uuid,numeric,numeric,text),public.update_journal_line(uuid,uuid,numeric,numeric,text),public.remove_journal_line(uuid),public.post_journal_entry(uuid) to authenticated;
