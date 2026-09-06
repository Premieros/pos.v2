import { supabase } from '../../lib/supabase/client'

export async function updateOrderNotes(orderId: string, notes: string | null): Promise<void> {
  const { error } = await supabase.rpc('update_order_notes', {
    p_order_id: orderId,
    p_notes: notes?.trim() || null,
  })
  if (error) throw error
}

export async function updateOrderItemNotes(orderItemId: string, notes: string | null): Promise<void> {
  const { error } = await supabase.rpc('update_order_item_notes', {
    p_order_item_id: orderItemId,
    p_notes: notes?.trim() || null,
  })
  if (error) throw error
}
