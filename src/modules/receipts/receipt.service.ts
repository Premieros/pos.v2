import { supabase } from '../../lib/supabase/client'

export type ReceiptSnapshot = {
  branch: { id: string; code: string; name_ar: string; name_en: string | null }
  order: { id: string; order_number: number; order_type: string; created_at: string; guest_count: number; subtotal: number; discount_total: number; total: number }
  items: Array<{ id: string; product_name: string; quantity: number; unit_price: number; line_total: number }>
  payments: Array<{ id: string; method: 'cash' | 'card'; amount: number; created_at: string }>
  captured_at: string
}

export type ReceiptPrintResult = {
  document_id: string
  event_id: string
  sequence: number
  event_type: 'first_print' | 'reprint'
  snapshot: ReceiptSnapshot
}

export type ReceiptPrintState = { hasReceipt: boolean; lastSequence: number }

export async function getReceiptPrintState(orderId: string): Promise<ReceiptPrintState> {
  const { data, error } = await supabase.rpc('get_receipt_print_state', { p_order_id: orderId })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return { hasReceipt: Boolean(row?.has_receipt), lastSequence: Number(row?.last_sequence ?? 0) }
}

export async function registerFirstReceiptPrint(orderId: string): Promise<ReceiptPrintResult> {
  const { data, error } = await supabase.rpc('register_first_receipt_print', {
    p_order_id: orderId,
    p_idempotency_key: crypto.randomUUID(),
  })
  if (error) throw error
  return data as ReceiptPrintResult
}

export async function registerReceiptReprint(orderId: string, reason: string): Promise<ReceiptPrintResult> {
  const { data, error } = await supabase.rpc('register_receipt_reprint', {
    p_order_id: orderId,
    p_reason: reason.trim(),
    p_idempotency_key: crypto.randomUUID(),
  })
  if (error) throw error
  return data as ReceiptPrintResult
}
