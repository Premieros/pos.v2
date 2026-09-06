create index if not exists modifier_options_branch_idx on public.modifier_options(branch_id);
create index if not exists order_item_modifiers_branch_idx on public.order_item_modifiers(branch_id);
create index if not exists order_item_modifiers_group_branch_idx on public.order_item_modifiers(modifier_group_id, branch_id);
create index if not exists product_modifier_groups_branch_idx on public.product_modifier_groups(branch_id);
create index if not exists product_modifier_groups_product_branch_idx on public.product_modifier_groups(product_id, branch_id);
