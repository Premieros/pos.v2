create or replace function app_private.get_sales_operations_report_internal(
  p_branch_id uuid,
  p_report_key text,
  p_from_date date,
  p_to_date date,
  p_payment_method text default null,
  p_employee_id uuid default null,
  p_product_id uuid default null,
  p_order_type text default null
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
  if p_payment_method is not null and p_payment_method not in ('cash','card') then raise exception 'invalid payment method'; end if;
  if p_order_type is not null and p_order_type not in ('dine_in','take_away','drive_thru','delivery','quick') then raise exception 'invalid order type'; end if;
  if p_report_key not in ('sales','invoices','payments','employees','products','returns','cashiers') then raise exception 'unsupported sales report'; end if;
  v_from := p_from_date::timestamptz;
  v_to := (p_to_date + 1)::timestamptz;

  if p_report_key='sales' then
    with eligible as (
      select o.id,o.total,o.discount_total,o.order_type,o.created_by
      from public.orders o
      where o.branch_id=p_branch_id
        and o.created_at>=v_from and o.created_at<v_to
        and o.status in ('paid','closed','returned')
        and (p_employee_id is null or o.created_by=p_employee_id)
        and (p_order_type is null or o.order_type=p_order_type)
        and (p_product_id is null or exists(select 1 from public.order_items oi where oi.order_id=o.id and oi.branch_id=o.branch_id and oi.product_id=p_product_id and not oi.is_removed))
        and (p_payment_method is null or exists(select 1 from public.payment_allocations pa join public.payments p on p.id=pa.payment_id and p.branch_id=pa.branch_id where pa.order_id=o.id and pa.branch_id=o.branch_id and p.method=p_payment_method and p.status in ('completed','refunded')))
    ), valueset as (
      select e.*,
        coalesce((select sum(pa.amount) from public.payment_allocations pa join public.payments p on p.id=pa.payment_id and p.branch_id=pa.branch_id where pa.order_id=e.id and pa.branch_id=p_branch_id and p.status in ('completed','refunded') and (p_payment_method is null or p.method=p_payment_method)),0) as paid_amount,
        coalesce((select sum(r.amount) from public.refunds r join public.order_returns ort on ort.id=r.return_id and ort.branch_id=r.branch_id where ort.order_id=e.id and r.branch_id=p_branch_id and (p_payment_method is null or r.method=p_payment_method)),0) as refund_amount
      from eligible e
    )
    select coalesce(jsonb_agg(jsonb_build_object('metric',x.metric,'value',x.value) order by x.sort_order),'[]'::jsonb),
      jsonb_build_object(
        'order_count',(select count(*) from valueset),
        'gross_sales',coalesce((select sum(total) from valueset),0),
        'discounts',coalesce((select sum(discount_total) from valueset),0),
        'paid',coalesce((select sum(paid_amount) from valueset),0),
        'refunds',coalesce((select sum(refund_amount) from valueset),0),
        'net_collected',coalesce((select sum(paid_amount-refund_amount) from valueset),0)
      )
    into v_rows,v_totals
    from (values
      (1,'عدد الطلبات',(select count(*)::numeric from valueset)),
      (2,'إجمالي المبيعات',(select coalesce(sum(total),0) from valueset)),
      (3,'الخصومات',(select coalesce(sum(discount_total),0) from valueset)),
      (4,'المدفوع',(select coalesce(sum(paid_amount),0) from valueset)),
      (5,'المرتجعات المالية',(select coalesce(sum(refund_amount),0) from valueset)),
      (6,'صافي التحصيل',(select coalesce(sum(paid_amount-refund_amount),0) from valueset))
    ) x(sort_order,metric,value);

  elsif p_report_key='invoices' then
    with rows as (
      select o.id,o.order_number,o.created_at,o.order_type,o.status,o.subtotal,o.discount_total,o.total,
             pr.display_name as employee_name,
             coalesce((select sum(pa.amount) from public.payment_allocations pa join public.payments p on p.id=pa.payment_id and p.branch_id=pa.branch_id where pa.order_id=o.id and pa.branch_id=o.branch_id and p.status in ('completed','refunded') and (p_payment_method is null or p.method=p_payment_method)),0) as paid_amount,
             coalesce((select sum(r.amount) from public.refunds r join public.order_returns ort on ort.id=r.return_id and ort.branch_id=r.branch_id where ort.order_id=o.id and r.branch_id=o.branch_id and (p_payment_method is null or r.method=p_payment_method)),0) as refund_amount
      from public.orders o
      left join public.profiles pr on pr.id=o.created_by
      where o.branch_id=p_branch_id and o.created_at>=v_from and o.created_at<v_to
        and o.status in ('paid','closed','returned')
        and (p_employee_id is null or o.created_by=p_employee_id)
        and (p_order_type is null or o.order_type=p_order_type)
        and (p_product_id is null or exists(select 1 from public.order_items oi where oi.order_id=o.id and oi.branch_id=o.branch_id and oi.product_id=p_product_id and not oi.is_removed))
        and (p_payment_method is null or exists(select 1 from public.payment_allocations pa join public.payments p on p.id=pa.payment_id and p.branch_id=pa.branch_id where pa.order_id=o.id and pa.branch_id=o.branch_id and p.method=p_payment_method and p.status in ('completed','refunded')))
      order by o.created_at desc
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'order_id',id,'order_number',order_number,'created_at',created_at,'order_type',order_type,'status',status,
      'employee',employee_name,'subtotal',subtotal,'discount',discount_total,'total',total,'paid',paid_amount,'refund',refund_amount,'net',paid_amount-refund_amount
    )),'[]'::jsonb),
    jsonb_build_object('invoice_count',count(*),'total',coalesce(sum(total),0),'paid',coalesce(sum(paid_amount),0),'refunds',coalesce(sum(refund_amount),0),'net',coalesce(sum(paid_amount-refund_amount),0))
    into v_rows,v_totals from rows;

  elsif p_report_key='payments' then
    with rows as (
      select p.method,count(distinct p.id) as payment_count,sum(pa.amount) as amount
      from public.payments p
      join public.payment_allocations pa on pa.payment_id=p.id and pa.branch_id=p.branch_id
      join public.orders o on o.id=pa.order_id and o.branch_id=pa.branch_id
      where p.branch_id=p_branch_id and p.created_at>=v_from and p.created_at<v_to and p.status in ('completed','refunded')
        and (p_payment_method is null or p.method=p_payment_method)
        and (p_employee_id is null or o.created_by=p_employee_id)
        and (p_order_type is null or o.order_type=p_order_type)
        and (p_product_id is null or exists(select 1 from public.order_items oi where oi.order_id=o.id and oi.branch_id=o.branch_id and oi.product_id=p_product_id and not oi.is_removed))
      group by p.method order by p.method
    )
    select coalesce(jsonb_agg(jsonb_build_object('method',method,'payment_count',payment_count,'amount',amount)),'[]'::jsonb),
           jsonb_build_object('payment_count',coalesce(sum(payment_count),0),'amount',coalesce(sum(amount),0))
    into v_rows,v_totals from rows;

  elsif p_report_key='employees' then
    with rows as (
      select o.created_by as employee_id,coalesce(pr.display_name,'—') as employee_name,count(distinct o.id) as order_count,
             sum(o.total) as gross_sales,
             coalesce(sum((select sum(pa.amount) from public.payment_allocations pa join public.payments p on p.id=pa.payment_id and p.branch_id=pa.branch_id where pa.order_id=o.id and pa.branch_id=o.branch_id and p.status in ('completed','refunded') and (p_payment_method is null or p.method=p_payment_method))),0) as paid_amount
      from public.orders o left join public.profiles pr on pr.id=o.created_by
      where o.branch_id=p_branch_id and o.created_at>=v_from and o.created_at<v_to and o.status in ('paid','closed','returned')
        and (p_employee_id is null or o.created_by=p_employee_id)
        and (p_order_type is null or o.order_type=p_order_type)
        and (p_product_id is null or exists(select 1 from public.order_items oi where oi.order_id=o.id and oi.branch_id=o.branch_id and oi.product_id=p_product_id and not oi.is_removed))
        and (p_payment_method is null or exists(select 1 from public.payment_allocations pa join public.payments p on p.id=pa.payment_id and p.branch_id=pa.branch_id where pa.order_id=o.id and pa.branch_id=o.branch_id and p.method=p_payment_method and p.status in ('completed','refunded')))
      group by o.created_by,pr.display_name order by gross_sales desc
    )
    select coalesce(jsonb_agg(jsonb_build_object('employee_id',employee_id,'employee',employee_name,'order_count',order_count,'gross_sales',gross_sales,'paid',paid_amount)),'[]'::jsonb),
           jsonb_build_object('order_count',coalesce(sum(order_count),0),'gross_sales',coalesce(sum(gross_sales),0),'paid',coalesce(sum(paid_amount),0))
    into v_rows,v_totals from rows;

  elsif p_report_key='products' then
    with rows as (
      select oi.product_id,oi.product_name,sum(oi.quantity) as quantity,sum(oi.line_total) as gross_sales,count(distinct o.id) as order_count
      from public.order_items oi join public.orders o on o.id=oi.order_id and o.branch_id=oi.branch_id
      where oi.branch_id=p_branch_id and not oi.is_removed and o.created_at>=v_from and o.created_at<v_to and o.status in ('paid','closed','returned')
        and (p_employee_id is null or o.created_by=p_employee_id)
        and (p_order_type is null or o.order_type=p_order_type)
        and (p_product_id is null or oi.product_id=p_product_id)
        and (p_payment_method is null or exists(select 1 from public.payment_allocations pa join public.payments p on p.id=pa.payment_id and p.branch_id=pa.branch_id where pa.order_id=o.id and pa.branch_id=o.branch_id and p.method=p_payment_method and p.status in ('completed','refunded')))
      group by oi.product_id,oi.product_name order by gross_sales desc
    )
    select coalesce(jsonb_agg(jsonb_build_object('product_id',product_id,'product',product_name,'quantity',quantity,'order_count',order_count,'gross_sales',gross_sales)),'[]'::jsonb),
           jsonb_build_object('quantity',coalesce(sum(quantity),0),'gross_sales',coalesce(sum(gross_sales),0),'distinct_products',count(*))
    into v_rows,v_totals from rows;

  elsif p_report_key='returns' then
    with events as (
      select ort.created_at as event_at,'return'::text as event_type,o.order_number,ort.total_amount as amount,ort.reason,ort.created_by,coalesce(pr.display_name,'—') as employee,o.order_type,o.id as order_id
      from public.order_returns ort join public.orders o on o.id=ort.order_id and o.branch_id=ort.branch_id left join public.profiles pr on pr.id=ort.created_by
      where ort.branch_id=p_branch_id and ort.created_at>=v_from and ort.created_at<v_to
      union all
      select ov.created_at,'void',o.order_number,o.total,ov.reason,ov.created_by,coalesce(pr.display_name,'—'),o.order_type,o.id
      from public.order_voids ov join public.orders o on o.id=ov.order_id and o.branch_id=ov.branch_id left join public.profiles pr on pr.id=ov.created_by
      where ov.branch_id=p_branch_id and ov.created_at>=v_from and ov.created_at<v_to
      union all
      select oda.created_at,'discount',o.order_number,oda.discount_amount,oda.reason,oda.created_by,coalesce(pr.display_name,'—'),o.order_type,o.id
      from public.order_discount_audit oda join public.orders o on o.id=oda.order_id and o.branch_id=oda.branch_id left join public.profiles pr on pr.id=oda.created_by
      where oda.branch_id=p_branch_id and oda.created_at>=v_from and oda.created_at<v_to and oda.action='applied'
      union all
      select r.created_at,'refund',o.order_number,r.amount,ort.reason,r.created_by,coalesce(pr.display_name,'—'),o.order_type,o.id
      from public.refunds r join public.order_returns ort on ort.id=r.return_id and ort.branch_id=r.branch_id join public.orders o on o.id=ort.order_id and o.branch_id=ort.branch_id left join public.profiles pr on pr.id=r.created_by
      where r.branch_id=p_branch_id and r.created_at>=v_from and r.created_at<v_to and (p_payment_method is null or r.method=p_payment_method)
    ), filtered as (
      select * from events e
      where (p_employee_id is null or e.created_by=p_employee_id)
        and (p_order_type is null or e.order_type=p_order_type)
        and (p_product_id is null or exists(select 1 from public.order_items oi where oi.order_id=e.order_id and oi.branch_id=p_branch_id and oi.product_id=p_product_id and not oi.is_removed))
      order by event_at desc
    )
    select coalesce(jsonb_agg(jsonb_build_object('event_at',event_at,'event_type',event_type,'order_number',order_number,'amount',amount,'reason',reason,'employee',employee)),'[]'::jsonb),
           jsonb_build_object('event_count',count(*),'amount',coalesce(sum(amount),0))
    into v_rows,v_totals from filtered;

  elsif p_report_key='cashiers' then
    with rows as (
      select s.id as shift_id,s.user_id,coalesce(pr.display_name,'—') as employee,s.status,s.opened_at,s.closed_at,s.opening_balance,s.expected_cash,s.actual_cash,s.cash_difference,
             coalesce((select sum(p.amount) from public.payments p where p.shift_id=s.id and p.branch_id=s.branch_id and p.status in ('completed','refunded')),0) as payments_total,
             coalesce((select sum(r.amount) from public.refunds r join public.payments p on p.id=r.payment_id and p.branch_id=r.branch_id where p.shift_id=s.id and r.branch_id=s.branch_id),0) as refunds_total
      from public.shifts s left join public.profiles pr on pr.id=s.user_id
      where s.branch_id=p_branch_id and s.opened_at<v_to and coalesce(s.closed_at,now())>=v_from
        and (p_employee_id is null or s.user_id=p_employee_id)
      order by s.opened_at desc
    )
    select coalesce(jsonb_agg(jsonb_build_object('shift_id',shift_id,'employee',employee,'status',status,'opened_at',opened_at,'closed_at',closed_at,'opening_balance',opening_balance,'expected_cash',expected_cash,'actual_cash',actual_cash,'cash_difference',cash_difference,'payments_total',payments_total,'refunds_total',refunds_total)),'[]'::jsonb),
           jsonb_build_object('shift_count',count(*),'payments_total',coalesce(sum(payments_total),0),'refunds_total',coalesce(sum(refunds_total),0),'cash_difference',coalesce(sum(cash_difference),0))
    into v_rows,v_totals from rows;
  end if;

  return jsonb_build_object('report_key',p_report_key,'rows',v_rows,'totals',v_totals,'generated_at',now());
end $$;
revoke all on function app_private.get_sales_operations_report_internal(uuid,text,date,date,text,uuid,uuid,text) from public,anon,authenticated;

create or replace function public.get_sales_operations_report(
  p_branch_id uuid,
  p_report_key text,
  p_from_date date,
  p_to_date date,
  p_payment_method text default null,
  p_employee_id uuid default null,
  p_product_id uuid default null,
  p_order_type text default null
) returns jsonb
language sql
security invoker
set search_path=''
as $$ select app_private.get_sales_operations_report_internal(p_branch_id,p_report_key,p_from_date,p_to_date,p_payment_method,p_employee_id,p_product_id,p_order_type) $$;
revoke all on function public.get_sales_operations_report(uuid,text,date,date,text,uuid,uuid,text) from public,anon;
grant execute on function public.get_sales_operations_report(uuid,text,date,date,text,uuid,uuid,text) to authenticated;
