insert into public.permissions(key,module,description)
values
 ('accounting.coa.view','accounting','View branch chart of accounts'),
 ('accounting.coa.manage','accounting','Create and maintain branch chart of accounts')
on conflict (key) do nothing;

create table public.accounts (
 id uuid primary key default gen_random_uuid(),
 branch_id uuid not null references public.branches(id),
 code text not null check (btrim(code) <> ''),
 name_ar text not null check (btrim(name_ar) <> ''),
 name_en text,
 account_type text not null check (account_type in ('asset','liability','equity','revenue','expense')),
 normal_balance text not null check (normal_balance in ('debit','credit')),
 parent_id uuid,
 is_postable boolean not null default true,
 is_active boolean not null default true,
 description text,
 created_by uuid not null default auth.uid() references auth.users(id),
 updated_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(branch_id,code),
 unique(id,branch_id),
 foreign key(parent_id,branch_id) references public.accounts(id,branch_id)
);

create index idx_accounts_branch_type_active on public.accounts(branch_id,account_type,is_active,code);
create index idx_accounts_parent_branch on public.accounts(parent_id,branch_id) where parent_id is not null;
create index idx_accounts_created_by on public.accounts(created_by);
create index idx_accounts_updated_by on public.accounts(updated_by);

alter table public.accounts enable row level security;
create policy accounts_select on public.accounts for select to authenticated using (
 app_private.current_user_may_access_branch(branch_id)
 and (
   app_private.current_user_has_permission('accounting.coa.view',branch_id)
   or app_private.current_user_has_permission('accounting.coa.manage',branch_id)
 )
);

revoke all on public.accounts from anon,authenticated;
grant select on public.accounts to authenticated;

create or replace function app_private.create_account_internal(
 p_branch_id uuid,p_code text,p_name_ar text,p_name_en text,p_account_type text,p_parent_id uuid default null,
 p_is_postable boolean default true,p_description text default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_parent public.accounts%rowtype; v_normal text;
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 if not app_private.has_permission('accounting.coa.manage',p_branch_id,auth.uid()) then raise exception 'permission denied'; end if;
 if nullif(btrim(p_code),'') is null then raise exception 'account code required'; end if;
 if nullif(btrim(p_name_ar),'') is null then raise exception 'account Arabic name required'; end if;
 if p_account_type not in ('asset','liability','equity','revenue','expense') then raise exception 'invalid account type'; end if;
 v_normal := case when p_account_type in ('asset','expense') then 'debit' else 'credit' end;
 if p_parent_id is not null then
   select * into v_parent from public.accounts where id=p_parent_id and branch_id=p_branch_id;
   if not found then raise exception 'parent account not found in branch'; end if;
   if not v_parent.is_active then raise exception 'parent account is inactive'; end if;
   if v_parent.account_type <> p_account_type then raise exception 'parent and child account types must match'; end if;
   if v_parent.is_postable then raise exception 'postable account cannot be a parent'; end if;
 end if;
 insert into public.accounts(branch_id,code,name_ar,name_en,account_type,normal_balance,parent_id,is_postable,description,created_by,updated_by)
 values(p_branch_id,btrim(p_code),btrim(p_name_ar),nullif(btrim(p_name_en),''),p_account_type,v_normal,p_parent_id,coalesce(p_is_postable,true),nullif(btrim(p_description),''),auth.uid(),auth.uid()) returning id into v_id;
 return v_id;
end $$;

create or replace function public.create_account(
 p_branch_id uuid,p_code text,p_name_ar text,p_name_en text,p_account_type text,p_parent_id uuid default null,
 p_is_postable boolean default true,p_description text default null
) returns uuid language sql security invoker set search_path='' as $$
 select app_private.create_account_internal(p_branch_id,p_code,p_name_ar,p_name_en,p_account_type,p_parent_id,p_is_postable,p_description)
$$;

create or replace function app_private.update_account_internal(
 p_account_id uuid,p_code text,p_name_ar text,p_name_en text,p_parent_id uuid,p_is_postable boolean,p_is_active boolean,p_description text
) returns void language plpgsql security definer set search_path='' as $$
declare v_account public.accounts%rowtype; v_parent public.accounts%rowtype; v_has_children boolean;
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 select * into v_account from public.accounts where id=p_account_id for update;
 if not found then raise exception 'account not found'; end if;
 if not app_private.has_permission('accounting.coa.manage',v_account.branch_id,auth.uid()) then raise exception 'permission denied'; end if;
 if nullif(btrim(p_code),'') is null or nullif(btrim(p_name_ar),'') is null then raise exception 'account code and Arabic name required'; end if;
 if p_parent_id = p_account_id then raise exception 'account cannot be its own parent'; end if;
 if p_parent_id is not null then
   select * into v_parent from public.accounts where id=p_parent_id and branch_id=v_account.branch_id;
   if not found then raise exception 'parent account not found in branch'; end if;
   if not v_parent.is_active then raise exception 'parent account is inactive'; end if;
   if v_parent.account_type <> v_account.account_type then raise exception 'parent and child account types must match'; end if;
   if v_parent.is_postable then raise exception 'postable account cannot be a parent'; end if;
   if exists(with recursive descendants as (select id,parent_id from public.accounts where id=p_account_id union all select a.id,a.parent_id from public.accounts a join descendants d on a.parent_id=d.id where a.branch_id=v_account.branch_id) select 1 from descendants where id=p_parent_id and id<>p_account_id) then raise exception 'account hierarchy cycle detected'; end if;
 end if;
 select exists(select 1 from public.accounts a where a.parent_id=p_account_id) into v_has_children;
 if coalesce(p_is_postable,true) and v_has_children then raise exception 'account with children cannot be postable'; end if;
 if not coalesce(p_is_active,true) and v_has_children and exists(select 1 from public.accounts a where a.parent_id=p_account_id and a.is_active) then raise exception 'cannot deactivate account with active children'; end if;
 update public.accounts set code=btrim(p_code),name_ar=btrim(p_name_ar),name_en=nullif(btrim(p_name_en),''),parent_id=p_parent_id,is_postable=coalesce(p_is_postable,true),is_active=coalesce(p_is_active,true),description=nullif(btrim(p_description),''),updated_by=auth.uid(),updated_at=now() where id=p_account_id;
end $$;

create or replace function public.update_account(
 p_account_id uuid,p_code text,p_name_ar text,p_name_en text,p_parent_id uuid default null,p_is_postable boolean default true,p_is_active boolean default true,p_description text default null
) returns void language sql security invoker set search_path='' as $$
 select app_private.update_account_internal(p_account_id,p_code,p_name_ar,p_name_en,p_parent_id,p_is_postable,p_is_active,p_description)
$$;

revoke all on function app_private.create_account_internal(uuid,text,text,text,text,uuid,boolean,text),app_private.update_account_internal(uuid,text,text,text,uuid,boolean,boolean,text) from public,anon,authenticated;
revoke all on function public.create_account(uuid,text,text,text,text,uuid,boolean,text),public.update_account(uuid,text,text,text,uuid,boolean,boolean,text) from public,anon;
grant execute on function public.create_account(uuid,text,text,text,text,uuid,boolean,text),public.update_account(uuid,text,text,text,uuid,boolean,boolean,text) to authenticated;
