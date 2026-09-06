create index if not exists idx_order_items_branch on public.order_items(branch_id);
create index if not exists idx_orders_created_by on public.orders(created_by);
create index if not exists idx_orders_cancelled_by on public.orders(cancelled_by) where cancelled_by is not null;
create index if not exists idx_shifts_opened_by on public.shifts(opened_by);
create index if not exists idx_shifts_closed_by on public.shifts(closed_by) where closed_by is not null;

drop policy if exists shifts_select on public.shifts;
create policy shifts_select on public.shifts for select to authenticated
using (
  public.current_user_can('shifts.view', branch_id)
  or public.current_user_can('shifts.manage', branch_id)
  or (
    user_id = (select auth.uid())
    and (select app_private.current_user_may_access_branch(branch_id))
  )
);

drop policy if exists drawer_movements_select on public.cash_drawer_movements;
create policy drawer_movements_select on public.cash_drawer_movements for select to authenticated
using (
  public.current_user_can('shifts.view', branch_id)
  or public.current_user_can('shifts.manage', branch_id)
  or exists (
    select 1
    from public.shifts s
    where s.id = cash_drawer_movements.shift_id
      and s.branch_id = cash_drawer_movements.branch_id
      and s.user_id = (select auth.uid())
  )
);
