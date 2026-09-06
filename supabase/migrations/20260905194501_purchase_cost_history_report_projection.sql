create or replace function app_private.get_purchase_cost_history_report_internal(
  p_branch_id uuid,
  p_from_date date,
  p_to_date date,
  p_product_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_rows jsonb := '[]'::jsonb;
  v_totals jsonb := '{}'::jsonb;
  v_from timestamptz;
  v_to timestamptz;
begin
  perform app_private.assert_report_access(p_branch_id);
  if p_from_date is null or p_to_date is null or p_from_date > p_to_date then
    raise exception 'invalid report date range';
  end if;
  v_from := p_from_date::timestamptz;
  v_to := (p_to_date + 1)::timestamptz;

  with rows as (
    select
      h.received_at,
      ii.code,
      ii.name_ar as item,
      ii.base_unit,
      s.name_ar as supplier,
      w.name_ar as warehouse,
      po.purchase_number,
      h.quantity,
      h.unit_cost,
      round(h.quantity * h.unit_cost, 2) as total_cost
    from public.inventory_item_purchase_cost_history h
    join public.inventory_items ii on ii.id=h.inventory_item_id and ii.branch_id=h.branch_id
    left join public.suppliers s on s.id=h.supplier_id and s.branch_id=h.branch_id
    left join public.warehouses w on w.id=h.warehouse_id and w.branch_id=h.branch_id
    left join public.purchase_orders po on po.id=h.purchase_order_id and po.branch_id=h.branch_id
    where h.branch_id=p_branch_id
      and h.received_at>=v_from and h.received_at<v_to
      and (p_product_id is null or h.inventory_item_id=p_product_id)
    order by h.received_at desc, ii.name_ar
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'received_at',received_at,
      'code',code,
      'item',item,
      'base_unit',base_unit,
      'supplier',supplier,
      'warehouse',warehouse,
      'purchase_number',purchase_number,
      'quantity',quantity,
      'unit_cost',unit_cost,
      'total_cost',total_cost
    )),'[]'::jsonb),
    jsonb_build_object(
      'receipt_line_count',count(*),
      'quantity',coalesce(sum(quantity),0),
      'total_cost',coalesce(sum(total_cost),0),
      'weighted_avg_cost',case when coalesce(sum(quantity),0)=0 then 0 else round(sum(total_cost)/sum(quantity),4) end
    )
  into v_rows,v_totals
  from rows;

  return jsonb_build_object('report_key','costs','rows',v_rows,'totals',v_totals,'generated_at',now());
end $$;

revoke all on function app_private.get_purchase_cost_history_report_internal(uuid,date,date,uuid) from public,anon,authenticated;

create or replace function public.get_purchase_cost_history_report(
  p_branch_id uuid,
  p_from_date date,
  p_to_date date,
  p_product_id uuid default null
) returns jsonb
language sql
security invoker
set search_path=''
as $$
  select app_private.get_purchase_cost_history_report_internal(p_branch_id,p_from_date,p_to_date,p_product_id)
$$;

revoke all on function public.get_purchase_cost_history_report(uuid,date,date,uuid) from public,anon;
grant execute on function public.get_purchase_cost_history_report(uuid,date,date,uuid) to authenticated;
