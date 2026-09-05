import { supabase } from '../../lib/supabase/client'

export type ReturnableOrder = {
  id: string
  order_number: number
  status: 'paid' | 'closed' | 'returned'
  subtotal: number
  total: number
  created_at: string
}

export type ReturnableItem = {
  id: string
  product_name: string
  unit_price: number
  quantity: number
  returned_quantity: number
}

export type RefundSource = {
  payment_id: string
  method: 'cash' | 'card'
  paid_amount: number
  refunded_amount: number
  available_amount: number
}

export type ReturnLineInput = {
  order_item_id: string
  quantity: number
  restock: boolean
  warehouse_id: string | null
}

export async function listReturnableOrders(branchId: string): Promise<ReturnableOrder[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_number, status, subtotal, total, created_at')
    .eq('branch_id', branchId)
    .in('status', ['paid', 'closed', 'returned'])
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) throw error
  return (data ?? []) as ReturnableOrder[]
}

export async function listReturnableItems(orderId: string): Promise<ReturnableItem[]> {
  const { data: items, error: itemError } = await supabase
    .from('order_items')
    .select('id, product_name, unit_price, quantity')
    .eq('order_id', orderId)
    .eq('is_removed', false)
    .order('created_at')
  if (itemError) throw itemError
  if (!items?.length) return []

  const ids = items.map((item) => item.id)
  const { data: returned, error: returnError } = await supabase
    .from('order_return_items')
    .select('order_item_id, quantity')
    .in('order_item_id', ids)
  if (returnError) throw returnError

  const returnedByItem = new Map<string, number>()
  for (const row of returned ?? []) {
    returnedByItem.set(row.order_item_id, (returnedByItem.get(row.order_item_id) ?? 0) + Number(row.quantity))
  }

  return items.map((item) => ({
    ...item,
    unit_price: Number(item.unit_price),
    quantity: Number(item.quantity),
    returned_quantity: returnedByItem.get(item.id) ?? 0,
  })) as ReturnableItem[]
}

export async function listRefundSources(orderId: string): Promise<RefundSource[]> {
  const { data: allocations, error: allocationError } = await supabase
    .from('payment_allocations')
    .select('payment_id, amount')
    .eq('order_id', orderId)
  if (allocationError) throw allocationError
  if (!allocations?.length) return []

  const ids = allocations.map((row) => row.payment_id)
  const [{ data: payments, error: paymentError }, { data: refunds, error: refundError }] = await Promise.all([
    supabase.from('payments').select('id, method').in('id', ids),
    supabase.from('refunds').select('payment_id, amount').in('payment_id', ids),
  ])
  if (paymentError) throw paymentError
  if (refundError) throw refundError

  const refundedByPayment = new Map<string, number>()
  for (const row of refunds ?? []) {
    refundedByPayment.set(row.payment_id, (refundedByPayment.get(row.payment_id) ?? 0) + Number(row.amount))
  }
  const methodByPayment = new Map((payments ?? []).map((row) => [row.id, row.method as 'cash' | 'card']))

  return allocations.map((row) => {
    const paid = Number(row.amount)
    const refunded = refundedByPayment.get(row.payment_id) ?? 0
    return {
      payment_id: row.payment_id,
      method: methodByPayment.get(row.payment_id) ?? 'cash',
      paid_amount: paid,
      refunded_amount: refunded,
      available_amount: Math.max(0, Number((paid - refunded).toFixed(2))),
    }
  }).filter((row) => row.available_amount > 0)
}

export function estimateReturnTotal(order: ReturnableOrder, items: ReturnableItem[], quantities: Record<string, number>): number {
  if (order.subtotal <= 0) return 0
  const gross = items.reduce((sum, item) => sum + item.unit_price * Math.max(0, quantities[item.id] ?? 0), 0)
  return Number((gross * (order.total / order.subtotal)).toFixed(2))
}

export function allocateRefund(total: number, sources: RefundSource[]): Array<{ payment_id: string; amount: number }> {
  let remaining = Number(total.toFixed(2))
  const allocations: Array<{ payment_id: string; amount: number }> = []
  for (const source of sources) {
    if (remaining <= 0) break
    const amount = Math.min(source.available_amount, remaining)
    if (amount > 0) allocations.push({ payment_id: source.payment_id, amount: Number(amount.toFixed(2)) })
    remaining = Number((remaining - amount).toFixed(2))
  }
  if (remaining > 0) throw new Error('قيمة المدفوعات المتاحة لا تكفي للمرتجع')
  return allocations
}

export async function returnOrder(input: { orderId: string; lines: ReturnLineInput[]; refunds: Array<{ payment_id: string; amount: number }>; reason: string }): Promise<string> {
  const { data, error } = await supabase.rpc('return_order', {
    p_order_id: input.orderId,
    p_lines: input.lines,
    p_refunds: input.refunds,
    p_reason: input.reason.trim(),
    p_idempotency_key: crypto.randomUUID(),
  })
  if (error) throw error
  return data as string
}
