import { useEffect, useMemo, useState } from 'react'
import type { PosOrder } from '../pos/pos.service'
import { closePaidOrder as closePaidOrderCommand, listOrderPayments, takePayment as takePaymentCommand, type OrderPayment, type PaymentMethod } from './payment.service'

export function usePayments(order: PosOrder | null) {
  const [payments, setPayments] = useState<OrderPayment[]>([])

  async function refreshPayments() {
    if (!order) {
      setPayments([])
      return
    }
    setPayments(await listOrderPayments(order.id))
  }

  useEffect(() => {
    void refreshPayments()
  }, [order?.id])

  const paidAmount = useMemo(
    () => payments.filter((payment) => payment.status === 'completed').reduce((sum, payment) => sum + payment.amount, 0),
    [payments],
  )
  const remainingAmount = Math.max(0, Number(((order?.total ?? 0) - paidAmount).toFixed(2)))

  async function takePayment(method: PaymentMethod, amount: number) {
    if (!order) throw new Error('لم يتم اختيار طلب')
    await takePaymentCommand({ orderId: order.id, method, amount })
  }

  async function closePaidOrder() {
    if (!order) throw new Error('لم يتم اختيار طلب')
    await closePaidOrderCommand(order.id)
  }

  return { payments, paidAmount, remainingAmount, refreshPayments, takePayment, closePaidOrder }
}
