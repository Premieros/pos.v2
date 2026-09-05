create or replace function app_private.get_customer_display_projection_internal(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid := auth.uid();
  v_branch_id uuid;
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;

  select branch_id into v_branch_id from public.orders where id=p_order_id;
  if v_branch_id is null then raise exception 'order not found'; end if;
  if not app_private.current_user_has_permission('pos.view',v_branch_id) then raise exception 'permission denied'; end if;

  select jsonb_build_object(
    'order', jsonb_build_object(
      'id', o.id,
      'order_number', o.order_number,
      'order_type', o.order_type,
      'status', o.status,
      'subtotal', o.subtotal,
      'discount_total', o.discount_total,
      'total', o.total
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', oi.id,
        'product_name', oi.product_name,
        'quantity', oi.quantity,
        'unit_price', oi.unit_price,
        'line_total', oi.line_total
      ) order by oi.created_at)
      from public.order_items oi
      where oi.order_id=o.id and oi.branch_id=o.branch_id and not oi.is_removed
    ), '[]'::jsonb),
    'payment', jsonb_build_object(
      'paid', coalesce((
        select round(sum(pa.amount),2)
        from public.payment_allocations pa
        join public.payments p on p.id=pa.payment_id and p.branch_id=pa.branch_id
        where pa.order_id=o.id and pa.branch_id=o.branch_id and p.status='completed'
      ),0),
      'remaining', greatest(0, o.total - coalesce((
        select round(sum(pa.amount),2)
        from public.payment_allocations pa
        join public.payments p on p.id=pa.payment_id and p.branch_id=pa.branch_id
        where pa.order_id=o.id and pa.branch_id=o.branch_id and p.status='completed'
      ),0))
    ),
    'projected_at', now()
  ) into v_result
  from public.orders o
  where o.id=p_order_id and o.branch_id=v_branch_id;

  return v_result;
end $$;

create or replace function public.get_customer_display_projection(p_order_id uuid)
returns jsonb
language sql
security invoker
set search_path=''
as $$ select app_private.get_customer_display_projection_internal(p_order_id); $$;

grant execute on function public.get_customer_display_projection(uuid) to authenticated;
revoke execute on function app_private.get_customer_display_projection_internal(uuid) from public,anon,authenticated;
