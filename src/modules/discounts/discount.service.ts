import { supabase } from '../../lib/supabase/client'

export type DiscountType = 'fixed' | 'percent'

export async function applyOrderDiscount(input: { orderId: string; type: DiscountType; value: number; reason: string }): Promise<void> {
  const { error } = await supabase.rpc('apply_order_discount', {
    p_order_id: input.orderId,
    p_discount_type: input.type,
    p_discount_value: input.value,
    p_reason: input.reason.trim(),
  })
  if (error) throw error
}

export async function clearOrderDiscount(orderId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('clear_order_discount', {
    p_order_id: orderId,
    p_reason: reason.trim(),
  })
  if (error) throw error
}
