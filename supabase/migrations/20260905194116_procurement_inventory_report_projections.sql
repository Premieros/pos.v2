create or replace function app_private.get_procurement_inventory_report_internal(
  p_branch_id uuid,
  p_report_key text,
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
  if p_from_date is null or p_to_date is null or p_from_date > p_to_date then raise exception 'invalid report date range'; end if;
  if p_report_key not in ('purchases','inventory','waste') then raise exception 'unsupported procurement inventory report'; end if;
  v_from := p_from_date::timestamptz;
  v_to := (p_to_date + 1)::timestamptz;

  if p_report_key='purchases' then
    with rows as (
      select po.id,po.purchase_number,po.created_at,po.status,s.name_ar as supplier,
             po.total,
             coalesce(sum(pol.ordered_quantity),0) as ordered_quantity,
             coalesce(sum(pol.received_quantity),0) as received_quantity,
             coalesce((select sum(prl.quantity*prl.unit_cost)
                       from public.purchase_receipts pr
                       join public.purchase_receipt_lines prl on prl.purchase_receipt_id=pr.id and prl.branch_id=pr.branch_id
                       where pr.purchase_order_id=po.id and pr.branch_id=po.branch_id),0) as received_value
      from public.purchase_orders po
      join public.suppliers s on s.id=po.supplier_id and s.branch_id=po.branch_id
      left join public.purchase_order_lines pol on pol.purchase_order_id=po.id and pol.branch_id=po.branch_id
      where po.branch_id=p_branch_id
        and po.created_at>=v_from and po.created_at<v_to
        and (p_product_id is null or exists(select 1 from public.purchase_order_lines x where x.purchase_order_id=po.id and x.branch_id=po.branch_id and x.inventory_item_id=p_product_id))
      group by po.id,po.purchase_number,po.created_at,po.status,s.name_ar,po.total
      order by po.created_at desc
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'purchase_number',purchase_number,'created_at',created_at,'status',status,'supplier',supplier,
      'ordered_quantity',ordered_quantity,'received_quantity',received_quantity,'total',total,'received_value',received_value
    )),'[]'::jsonb),
    jsonb_build_object('purchase_count',count(*),'total',coalesce(sum(total),0),'received_value',coalesce(sum(received_value),0),'ordered_quantity',coalesce(sum(ordered_quantity),0),'received_quantity',coalesce(sum(received_quantity),0))
    into v_rows,v_totals from rows;

  elsif p_report_key='inventory' then
    with movement as (
      select sm.inventory_item_id,sm.warehouse_id,
             coalesce(sum(case when sm.created_at>=v_from and sm.created_at<v_to and sm.quantity_delta>0 then sm.quantity_delta else 0 end),0) as inbound,
             coalesce(sum(case when sm.created_at>=v_from and sm.created_at<v_to and sm.quantity_delta<0 then abs(sm.quantity_delta) else 0 end),0) as outbound
      from public.stock_movements sm
      where sm.branch_id=p_branch_id and (p_product_id is null or sm.inventory_item_id=p_product_id)
      group by sm.inventory_item_id,sm.warehouse_id
    ), rows as (
      select ib.inventory_item_id,ii.code,ii.name_ar as item,ii.base_unit,w.name_ar as warehouse,
             coalesce(ib.quantity,0) as balance,ii.minimum_level,
             (coalesce(ib.quantity,0) < ii.minimum_level) as below_minimum,
             coalesce(m.inbound,0) as inbound,coalesce(m.outbound,0) as outbound
      from public.inventory_balances ib
      join public.inventory_items ii on ii.id=ib.inventory_item_id and ii.branch_id=ib.branch_id
      join public.warehouses w on w.id=ib.warehouse_id and w.branch_id=ib.branch_id
      left join movement m on m.inventory_item_id=ib.inventory_item_id and m.warehouse_id=ib.warehouse_id
      where ib.branch_id=p_branch_id and (p_product_id is null or ib.inventory_item_id=p_product_id)
      order by ii.name_ar,w.name_ar
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'code',code,'item',item,'base_unit',base_unit,'warehouse',warehouse,'balance',balance,'minimum_level',minimum_level,'below_minimum',below_minimum,'inbound',inbound,'outbound',outbound
    )),'[]'::jsonb),
    jsonb_build_object('item_rows',count(*),'balance',coalesce(sum(balance),0),'inbound',coalesce(sum(inbound),0),'outbound',coalesce(sum(outbound),0),'low_stock_count',count(*) filter (where below_minimum))
    into v_rows,v_totals from rows;

  elsif p_report_key='waste' then
    with rows as (
      select coalesce(wd.posted_at,wd.created_at) as event_at,wd.status,wd.reason,w.name_ar as warehouse,
             ii.code,ii.name_ar as item,wdl.quantity,ii.base_unit,wdl.note
      from public.waste_documents wd
      join public.waste_document_lines wdl on wdl.waste_document_id=wd.id and wdl.branch_id=wd.branch_id
      join public.inventory_items ii on ii.id=wdl.inventory_item_id and ii.branch_id=wdl.branch_id
      join public.warehouses w on w.id=wd.warehouse_id and w.branch_id=wd.branch_id
      where wd.branch_id=p_branch_id
        and coalesce(wd.posted_at,wd.created_at)>=v_from and coalesce(wd.posted_at,wd.created_at)<v_to
        and (p_product_id is null or wdl.inventory_item_id=p_product_id)
      order by event_at desc
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'event_at',event_at,'status',status,'reason',reason,'warehouse',warehouse,'code',code,'item',item,'quantity',quantity,'base_unit',base_unit,'note',note
    )),'[]'::jsonb),
    jsonb_build_object('line_count',count(*),'quantity',coalesce(sum(quantity),0))
    into v_rows,v_totals from rows;
  end if;

  return jsonb_build_object('report_key',p_report_key,'rows',v_rows,'totals',v_totals,'generated_at',now());
end $$;
revoke all on function app_private.get_procurement_inventory_report_internal(uuid,text,date,date,uuid) from public,anon,authenticated;

create or replace function public.get_procurement_inventory_report(
  p_branch_id uuid,
  p_report_key text,
  p_from_date date,
  p_to_date date,
  p_product_id uuid default null
) returns jsonb
language sql
security invoker
set search_path=''
as $$
  select app_private.get_procurement_inventory_report_internal(p_branch_id,p_report_key,p_from_date,p_to_date,p_product_id)
$$;
revoke all on function public.get_procurement_inventory_report(uuid,text,date,date,uuid) from public,anon;
grant execute on function public.get_procurement_inventory_report(uuid,text,date,date,uuid) to authenticated;
