revoke all on table public.order_bill_splits from authenticated;
revoke all on table public.order_bill_split_lines from authenticated;
grant select on table public.order_bill_splits to authenticated;
grant select on table public.order_bill_split_lines to authenticated;
