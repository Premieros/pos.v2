import { supabase } from '../../lib/supabase/client'
import type { PosOrderItem } from '../pos/pos.service'

export type BillSplit = {
  id: string
  order_id: string
  label: string
  total_amount: number
  paid_amount: number
  remaining_amount: number
}

export async function listBillSplits(orderId: string): Promise<BillSplit[]> {
  const { data: splits, error: splitError } = await supabase
    .from('order_bill_splits')
    .select('id, order_id, label, total_amount')
    .eq('order_id', orderId)
    .order('created_at')
  if (splitError) throw splitError
  if (!splits?.length) return []

  const ids = splits.map((split) => split.id)
  const { data: allocations, error: allocationError } = await supabase
    .from('payment_allocations')
    .select('bill_split_id, payment_id, amount')
    .in('bill_split_id', ids)
  if (allocationError) throw allocationError

  const paymentIds = [...new Set((allocations ?? []).map((row) => row.payment_id))]
  let completedIds = new Set<string>()
  if (paymentIds.length) {
    const { data: payments, error: paymentError } = await supabase
      .from('payments')
      .select('id, status')
      .in('id', paymentIds)
    if (paymentError) throw paymentError
    completedIds = new Set((payments ?? []).filter((payment) => payment.status === 'completed').map((payment) => payment.id))
  }

  const paidBySplit = new Map<string, number>()
  for (const row of allocations ?? []) {
    if (!row.bill_split_id || !completedIds.has(row.payment_id)) continue
    paidBySplit.set(row.bill_split_id, (paidBySplit.get(row.bill_split_id) ?? 0) + Number(row.amount))
  }

  return splits.map((split) => {
    const total = Number(split.total_amount)
    const paid = paidBySplit.get(split.id) ?? 0
    return {
      id: split.id,
      order_id: split.order_id,
      label: split.label,
      total_amount: total,
      paid_amount: paid,
      remaining_amount: Math.max(0, Number((total - paid).toFixed(2))),
    }
  })
}

export function buildEqualSplits(items: PosOrderItem[], parts: number) {
  if (!Number.isInteger(parts) || parts < 2 || parts > 6) throw new Error('عدد الفواتير يجب أن يكون من 2 إلى 6')
  const activeItems = items.filter((item) => !item.is_removed && item.quantity > 0)
  if (!activeItems.length) throw new Error('لا توجد عناصر قابلة للتقسيم')

  return Array.from({ length: parts }, (_, partIndex) => ({
    label: `فاتورة ${partIndex + 1}`,
    lines: activeItems.map((item) => {
      const totalMilli = Math.round(item.quantity * 1000)
      const baseMilli = Math.floor(totalMilli / parts)
      const usedBeforeLast = baseMilli * (parts - 1)
      const milli = partIndex === parts - 1 ? totalMilli - usedBeforeLast : baseMilli
      return { order_item_id: item.id, quantity: milli / 1000 }
    }).filter((line) => line.quantity > 0),
  }))
}

export async function createOrderBillSplits(orderId: string, splits: Array<{ label: string; lines: Array<{ order_item_id: string; quantity: number }> }>): Promise<void> {
  const { error } = await supabase.rpc('create_order_bill_split', { p_order_id: orderId, p_splits: splits })
  if (error) throw error
}

export async function takeSplitPayment(splitId: string, method: 'cash' | 'card', amount: number): Promise<string> {
  const { data, error } = await supabase.rpc('take_split_payment', {
    p_split_id: splitId,
    p_method: method,
    p_amount: amount,
    p_idempotency_key: crypto.randomUUID(),
  })
  if (error) throw error
  return data as string
}
