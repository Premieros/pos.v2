alter policy customers_select on public.customers using (
  app_private.current_user_may_access_branch(branch_id) and (
    app_private.current_user_has_permission('pos.view',branch_id) or
    app_private.current_user_has_permission('customers.view',branch_id) or
    app_private.current_user_has_permission('customers.create',branch_id) or
    app_private.current_user_has_permission('customers.manage',branch_id)
  )
);

alter policy customer_addresses_select on public.customer_addresses using (
  app_private.current_user_may_access_branch(branch_id) and (
    app_private.current_user_has_permission('pos.view',branch_id) or
    app_private.current_user_has_permission('customers.view',branch_id) or
    app_private.current_user_has_permission('customers.create',branch_id) or
    app_private.current_user_has_permission('customers.manage',branch_id)
  )
);

alter policy modifier_groups_select on public.modifier_groups using (
  app_private.current_user_may_access_branch(branch_id) and (
    app_private.current_user_has_permission('catalog.view',branch_id) or
    app_private.current_user_has_permission('catalog.manage',branch_id) or
    app_private.current_user_has_permission('pos.view',branch_id)
  )
);

alter policy modifier_options_select on public.modifier_options using (
  app_private.current_user_may_access_branch(branch_id) and (
    app_private.current_user_has_permission('catalog.view',branch_id) or
    app_private.current_user_has_permission('catalog.manage',branch_id) or
    app_private.current_user_has_permission('pos.view',branch_id)
  )
);

alter policy product_modifier_groups_select on public.product_modifier_groups using (
  app_private.current_user_may_access_branch(branch_id) and (
    app_private.current_user_has_permission('catalog.view',branch_id) or
    app_private.current_user_has_permission('catalog.manage',branch_id) or
    app_private.current_user_has_permission('pos.view',branch_id)
  )
);

alter policy order_item_modifiers_select on public.order_item_modifiers using (
  app_private.current_user_may_access_branch(branch_id) and
  app_private.current_user_has_permission('pos.view',branch_id)
);