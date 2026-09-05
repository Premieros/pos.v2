import { supabase } from '../../lib/supabase/client'

export type PaymentMethod = 'cash' | 'card'

export type OrderPayment = {
  id: string
  method: PaymentMethod
  amount: number
  status: 'completed' | 'refunded' | 'voided'
  created_at: string
}

export async function listOrderPayments(orderId: string): Promise<OrderPayment[]> {
  const { data: allocations, error: allocationError } = await supabase
    .from('payment_allocations')
    .select('payment_id, amount')
    .eq('order_id', orderId)

  if (allocationError) throw allocationError
  if (!allocations?.length) return []

  const paymentIds = allocations.map((allocation) => allocation.payment_id)
  const { data: payments, error: paymentError } = await supabase
    .from('payments')
    .select('id, method, amount, status, created_at')
    .in('id', paymentIds)
    .order('created_at')

  if (paymentError) throw paymentError
  return (payments ?? []) as OrderPayment[]
}

export async function takePayment(input: { orderId: string; method: PaymentMethod; amount: number }): Promise<string> {
  const { data, error } = await supabase.rpc('take_payment', {
    p_order_id: input.orderId,
    p_method: input.method,
    p_amount: input.amount,
    p_idempotency_key: crypto.randomUUID(),
  })
  if (error) throw error
  return data as string
}

export async function closePaidOrder(orderId: string): Promise<void> {
  const { error } = await supabase.rpc('close_paid_order', { p_order_id: orderId })
  if (error) throw error
}
