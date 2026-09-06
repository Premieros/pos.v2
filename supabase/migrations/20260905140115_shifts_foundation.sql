insert into public.permissions(key,module,description) values
('shifts.view','shifts','View shifts and drawer summaries'),
('shifts.open','shifts','Open own shift'),
('shifts.close','shifts','Close own shift'),
('shifts.cash.move','shifts','Record cash drawer movements'),
('shifts.manage','shifts','Manage all branch shifts')
on conflict (key) do update set module=excluded.module, description=excluded.description;

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'open' check (status in ('open','closed')),
  opening_balance numeric(14,2) not null default 0 check (opening_balance >= 0),
  expected_cash numeric(14,2), actual_cash numeric(14,2), cash_difference numeric(14,2),
  opened_at timestamptz not null default now(), closed_at timestamptz,
  opened_by uuid not null references auth.users(id) on delete restrict,
  closed_by uuid references auth.users(id) on delete restrict,
  close_note text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint shifts_closed_state_chk check ((status='open' and closed_at is null and closed_by is null) or (status='closed' and closed_at is not null and closed_by is not null and actual_cash is not null and expected_cash is not null and cash_difference is not null)),
  unique(id, branch_id)
);
create unique index shifts_one_open_per_user_branch on public.shifts(branch_id,user_id) where status='open';
create index idx_shifts_branch_status on public.shifts(branch_id,status,opened_at desc);
create index idx_shifts_user_status on public.shifts(user_id,status,opened_at desc);

create table public.cash_drawer_movements (
  id uuid primary key default gen_random_uuid(), branch_id uuid not null references public.branches(id) on delete restrict,
  shift_id uuid not null, movement_type text not null check (movement_type in ('cash_in','cash_out')),
  amount numeric(14,2) not null check (amount > 0), reason text not null, idempotency_key uuid not null,
  created_by uuid not null references auth.users(id) on delete restrict, created_at timestamptz not null default now(),
  constraint cash_drawer_movements_shift_branch_fkey foreign key (shift_id,branch_id) references public.shifts(id,branch_id) on delete restrict,
  unique(branch_id,idempotency_key)
);
create index idx_cash_drawer_movements_shift_branch on public.cash_drawer_movements(shift_id,branch_id);
create index idx_cash_drawer_movements_created_by on public.cash_drawer_movements(created_by);

alter table public.shifts enable row level security;
alter table public.cash_drawer_movements enable row level security;
grant select on public.shifts, public.cash_drawer_movements to authenticated;
create policy shifts_select on public.shifts for select to authenticated using (public.current_user_can('shifts.view', branch_id) or public.current_user_can('shifts.manage', branch_id) or (user_id = auth.uid() and app_private.current_user_may_access_branch(branch_id)));
create policy drawer_movements_select on public.cash_drawer_movements for select to authenticated using (public.current_user_can('shifts.view', branch_id) or public.current_user_can('shifts.manage', branch_id) or exists (select 1 from public.shifts s where s.id=shift_id and s.branch_id=branch_id and s.user_id=auth.uid()));
revoke insert, update, delete on public.shifts, public.cash_drawer_movements from authenticated;
