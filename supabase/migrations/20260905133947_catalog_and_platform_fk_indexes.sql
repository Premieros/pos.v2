create index if not exists idx_platform_role_assignments_role
  on app_private.platform_role_assignments(role_id, user_id);

create index if not exists idx_products_category_branch
  on public.products(category_id, branch_id);
