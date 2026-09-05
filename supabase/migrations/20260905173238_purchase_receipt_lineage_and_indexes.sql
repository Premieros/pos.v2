alter table public.purchase_order_lines
  add constraint purchase_order_lines_id_branch_id_key unique (id, branch_id);

alter table public.purchase_receipt_lines
  add constraint purchase_receipt_lines_purchase_order_line_branch_fkey
  foreign key (purchase_order_line_id, branch_id)
  references public.purchase_order_lines(id, branch_id)
  on delete restrict;

create index idx_purchase_receipt_lines_branch on public.purchase_receipt_lines(branch_id);
