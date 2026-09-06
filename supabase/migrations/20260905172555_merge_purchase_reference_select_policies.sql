-- Merge procurement reference reads into the existing SELECT policies.
-- Preserves branch isolation and avoids multiple permissive SELECT policies.

drop policy if exists suppliers_purchase_reference_select on public.suppliers;
drop policy if exists suppliers_select on public.suppliers;
create policy suppliers_select on public.suppliers
for select to authenticated
using (
  app_private.current_user_may_access_branch(branch_id)
  and (
    app_private.current_user_has_permission('procurement.view',branch_id)
    or app_private.current_user_has_permission('procurement.suppliers.manage',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.view',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.create',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.edit',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.receive',branch_id)
  )
);

drop policy if exists inventory_items_purchase_reference_select on public.inventory_items;
drop policy if exists inventory_items_select on public.inventory_items;
create policy inventory_items_select on public.inventory_items
for select to authenticated
using (
  app_private.current_user_may_access_branch(branch_id)
  and (
    app_private.current_user_has_permission('inventory.view',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.view',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.create',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.edit',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.receive',branch_id)
  )
);
