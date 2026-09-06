create index if not exists customer_addresses_customer_branch_cover_idx
  on public.customer_addresses(customer_id, branch_id);
create index if not exists orders_customer_branch_cover_idx
  on public.orders(customer_id, branch_id)
  where customer_id is not null;
create index if not exists orders_delivery_address_branch_cover_idx
  on public.orders(delivery_address_id, branch_id)
  where delivery_address_id is not null;

drop policy if exists customers_select on public.customers;
create policy customers_select on public.customers for select to authenticated
using (
  app_private.user_may_access_branch(branch_id, (select auth.uid()))
  and (
    app_private.current_user_has_permission('pos.view', branch_id)
    or app_private.current_user_has_permission('customers.view', branch_id)
    or app_private.current_user_has_permission('customers.create', branch_id)
    or app_private.current_user_has_permission('customers.manage', branch_id)
  )
);

drop policy if exists customer_addresses_select on public.customer_addresses;
create policy customer_addresses_select on public.customer_addresses for select to authenticated
using (
  app_private.user_may_access_branch(branch_id, (select auth.uid()))
  and (
    app_private.current_user_has_permission('pos.view', branch_id)
    or app_private.current_user_has_permission('customers.view', branch_id)
    or app_private.current_user_has_permission('customers.create', branch_id)
    or app_private.current_user_has_permission('customers.manage', branch_id)
  )
);
