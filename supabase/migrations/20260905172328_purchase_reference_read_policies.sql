-- Batch 6.2 dependency hardening
-- Purchase users need read-only supplier and inventory-item reference data.
-- This does not grant supplier management or inventory mutation authority.

create policy suppliers_purchase_reference_select on public.suppliers
for select to authenticated
using (
  app_private.current_user_may_access_branch(branch_id)
  and (
    app_private.current_user_has_permission('procurement.purchases.view',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.create',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.edit',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.receive',branch_id)
  )
);

create policy inventory_items_purchase_reference_select on public.inventory_items
for select to authenticated
using (
  app_private.current_user_may_access_branch(branch_id)
  and (
    app_private.current_user_has_permission('procurement.purchases.view',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.create',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.edit',branch_id)
    or app_private.current_user_has_permission('procurement.purchases.receive',branch_id)
  )
);
