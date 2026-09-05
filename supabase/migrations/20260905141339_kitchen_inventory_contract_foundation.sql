alter table public.products add column if not exists inventory_item_id uuid;
alter table public.products drop constraint if exists products_inventory_item_branch_fkey;
alter table public.products add constraint products_inventory_item_branch_fkey foreign key (inventory_item_id, branch_id) references public.inventory_items(id, branch_id) on delete restrict;
create index if not exists idx_products_inventory_item_branch on public.products(inventory_item_id,branch_id) where inventory_item_id is not null;

insert into public.permissions(key,module,description) values
('kitchen.ticket.update','kitchen','Update kitchen ticket state')
on conflict (key) do nothing;

create table public.kitchen_tickets (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  order_id uuid not null,
  sequence_no integer not null,
  status text not null default 'queued' check (status in ('queued','preparing','ready','completed','cancelled')),
  warehouse_id uuid not null,
  idempotency_key text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ready_at timestamptz,
  completed_at timestamptz,
  unique(order_id,sequence_no),
  unique(branch_id,idempotency_key),
  unique(id,branch_id),
  constraint kitchen_tickets_order_branch_fkey foreign key (order_id,branch_id) references public.orders(id,branch_id) on delete restrict,
  constraint kitchen_tickets_warehouse_branch_fkey foreign key (warehouse_id,branch_id) references public.warehouses(id,branch_id) on delete restrict
);

create table public.kitchen_ticket_items (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  kitchen_ticket_id uuid not null,
  order_item_id uuid not null,
  product_name text not null,
  quantity_delta numeric(14,3) not null check (quantity_delta <> 0),
  created_at timestamptz not null default now(),
  constraint kitchen_ticket_items_ticket_branch_fkey foreign key (kitchen_ticket_id,branch_id) references public.kitchen_tickets(id,branch_id) on delete cascade,
  constraint kitchen_ticket_items_order_item_branch_fkey foreign key (order_item_id,branch_id) references public.order_items(id,branch_id) on delete restrict
);

create index idx_kitchen_tickets_branch_status_created on public.kitchen_tickets(branch_id,status,created_at);
create index idx_kitchen_tickets_order_branch on public.kitchen_tickets(order_id,branch_id);
create index idx_kitchen_tickets_warehouse_branch on public.kitchen_tickets(warehouse_id,branch_id);
create index idx_kitchen_ticket_items_ticket_branch on public.kitchen_ticket_items(kitchen_ticket_id,branch_id);
create index idx_kitchen_ticket_items_order_item_branch on public.kitchen_ticket_items(order_item_id,branch_id);

alter table public.kitchen_tickets enable row level security;
alter table public.kitchen_ticket_items enable row level security;
revoke all on public.kitchen_tickets,public.kitchen_ticket_items from anon,authenticated;
grant select on public.kitchen_tickets,public.kitchen_ticket_items to authenticated;

create policy kitchen_tickets_select on public.kitchen_tickets for select to authenticated
using ((select app_private.current_user_has_permission('kitchen.view',branch_id)) or (select app_private.current_user_has_permission('kitchen.manage',branch_id)));
create policy kitchen_ticket_items_select on public.kitchen_ticket_items for select to authenticated
using ((select app_private.current_user_has_permission('kitchen.view',branch_id)) or (select app_private.current_user_has_permission('kitchen.manage',branch_id)));
