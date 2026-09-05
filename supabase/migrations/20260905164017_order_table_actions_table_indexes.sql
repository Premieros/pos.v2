create index if not exists idx_order_table_actions_from_table_branch on public.order_table_actions(from_table_id,branch_id) where from_table_id is not null;
create index if not exists idx_order_table_actions_to_table_branch on public.order_table_actions(to_table_id,branch_id);
