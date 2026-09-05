create index if not exists idx_product_components_product_branch
  on public.product_components(product_id, branch_id);
create index if not exists idx_product_components_item_branch
  on public.product_components(inventory_item_id, branch_id);
create index if not exists idx_stock_movements_warehouse_branch
  on public.stock_movements(warehouse_id, branch_id);
create index if not exists idx_stock_movements_item_branch
  on public.stock_movements(inventory_item_id, branch_id);
