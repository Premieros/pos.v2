revoke all on table public.order_returns from authenticated;
revoke all on table public.order_return_items from authenticated;
revoke all on table public.refunds from authenticated;
grant select on table public.order_returns to authenticated;
grant select on table public.order_return_items to authenticated;
grant select on table public.refunds to authenticated;
