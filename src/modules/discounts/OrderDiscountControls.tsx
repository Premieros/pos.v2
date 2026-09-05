import { useState } from 'react'
import type { PosOrder } from '../pos/pos.service'
import { applyOrderDiscount, clearOrderDiscount, type DiscountType } from './discount.service'

export function OrderDiscountControls({
  order,
  canApply,
  paymentStarted,
  onChanged,
}: {
  order: PosOrder
  canApply: boolean
  paymentStarted: boolean
  onChanged: () => Promise<void>
}) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const editableStatus = ['created', 'held', 'sent_to_kitchen', 'preparing', 'ready'].includes(order.status)
  const editable = canApply && editableStatus && !paymentStarted && order.subtotal > 0

  if (!canApply && order.discount_total <= 0) return null

  async function handleApply(form: HTMLFormElement) {
    const data = new FormData(form)
    const type = String(data.get('discountType')) as DiscountType
    const value = Number(data.get('discountValue'))
    const reason = String(data.get('discountReason') ?? '')

    setBusy(true)
    setError(null)
    try {
      await applyOrderDiscount({ orderId: order.id, type, value, reason })
      form.reset()
      await onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تطبيق الخصم')
    } finally {
      setBusy(false)
    }
  }

  async function handleClear() {
    const reason = window.prompt('سبب إلغاء الخصم')
    if (!reason) return
    setBusy(true)
    setError(null)
    try {
      await clearOrderDiscount(order.id, reason)
      await onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر إلغاء الخصم')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="payment-card" aria-label="خصم الطلب">
      <div className="payment-summary">
        <span>قبل الخصم: <strong>{order.subtotal.toFixed(2)}</strong></span>
        <span>الخصم: <strong>{order.discount_total.toFixed(2)}</strong></span>
        <span>بعد الخصم: <strong>{order.total.toFixed(2)}</strong></span>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      {editable ? (
        <form className="payment-form" onSubmit={(event) => { event.preventDefault(); void handleApply(event.currentTarget) }}>
          <select name="discountType" defaultValue="percent" aria-label="نوع الخصم">
            <option value="percent">نسبة %</option>
            <option value="fixed">مبلغ ثابت</option>
          </select>
          <input name="discountValue" type="number" min="0.01" step="0.01" required placeholder="قيمة الخصم" aria-label="قيمة الخصم" />
          <input name="discountReason" required placeholder="سبب الخصم" aria-label="سبب الخصم" />
          <button type="submit" disabled={busy}>تطبيق الخصم</button>
          {order.discount_total > 0 ? <button type="button" disabled={busy} onClick={() => void handleClear()}>إلغاء الخصم</button> : null}
        </form>
      ) : paymentStarted ? <p>لا يمكن تعديل الخصم بعد بدء الدفع.</p> : null}
    </div>
  )
}
