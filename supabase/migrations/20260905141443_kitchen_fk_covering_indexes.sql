create index if not exists idx_kitchen_ticket_items_branch on public.kitchen_ticket_items(branch_id);
create index if not exists idx_kitchen_tickets_created_by on public.kitchen_tickets(created_by);
