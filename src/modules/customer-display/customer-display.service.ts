import { supabase } from '../../lib/supabase/client'

export type CustomerDisplayProjection = {
  order: {
    id: string
    order_number: number
    order_type: string
    status: string
    subtotal: number
    discount_total: number
    total: number
  }
  items: Array<{
    id: string
    product_name: string
    quantity: number
    unit_price: number
    line_total: number
  }>
  payment: {
    paid: number
    remaining: number
  }
  projected_at: string
}

export async function getCustomerDisplayProjection(orderId: string): Promise<CustomerDisplayProjection> {
  const { data, error } = await supabase.rpc('get_customer_display_projection', { p_order_id: orderId })
  if (error) throw error
  return data as CustomerDisplayProjection
}
