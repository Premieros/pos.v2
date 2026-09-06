import { useEffect, useMemo, useState } from 'react'
import type { PosOrder } from '../pos/pos.service'
import type { OrderPayment, PaymentMethod } from './payment.service'
import '../../styles/payments.css'

export function CheckoutPanel({
  order,
  payments,
  paidAmount,
  remainingAmount,
  canPay,
  paymentReady,
  hasBillSplits,
  canClose,
  takePayment,
  closePaidOrder,
  onChanged,
}: {
  order: PosOrder
  payments: OrderPayment[]
  paidAmount: number
  remainingAmount: number
  canPay: boolean
  paymentReady: boolean
  hasBillSplits: boolean
  canClose: boolean
  takePayment: (method: PaymentMethod, amount: number) => Promise<void>
  closePaidOrder: () => Promise<void>
  onChanged: () => Promise<void> | void
}) {
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [amount, setAmount] = useState(remainingAmount > 0 ? remainingAmount.toFixed(2) : '')
  const [cashReceived, setCashReceived] = useState(remainingAmount > 0 ? remainingAmount.toFixed(2) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const next = remainingAmount > 0 ? remainingAmount.toFixed(2) : ''
    setAmount(next)
    if (method === 'cash') setCashReceived(next)
  }, [order.id, remainingAmount])

  const amountNumber = Number(amount || 0)
  const receivedNumber = Number(cashReceived || 0)
  const change = useMemo(() => method === 'cash' ? Math.max(0, receivedNumber - amountNumber) : 0, [method, receivedNumber, amountNumber])
  const validAmount = amountNumber > 0 && amountNumber <= remainingAmount
  const cashValid = method !== 'cash' || receivedNumber >= amountNumber

  async function collect() {
    if (!canPay || !paymentReady || hasBillSplits || !validAmount || !cashValid) return
    setSaving(true)
    setError(null)
    try {
      await takePayment(method, amountNumber)
      await onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحصيل الدفعة')
    } finally {
      setSaving(false)
    }
  }

  async function close() {
    if (!canClose || order.status !== 'paid') return
    setSaving(true)
    setError(null)
    try {
      await closePaidOrder()
      await onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر إغلاق الطلب')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="checkout-panel" aria-label="الدفع وإغلاق الطلب">
      <div className="checkout-heading">
        <div><span>المبلغ المطلوب</span><strong>{remainingAmount.toFixed(2)}</strong></div>
        <div className="checkout-totals">
          <span>الإجمالي <strong>{order.total.toFixed(2)}</strong></span>
          <span>المدفوع <strong>{paidAmount.toFixed(2)}</strong></span>
        </div>
      </div>

      {payments.length ? <div className="payment-history" aria-label="الدفعات السابقة">
        {payments.map((payment, index) => <span key={payment.id}>دفعة {index + 1} · {payment.method === 'cash' ? 'نقدي' : 'بطاقة'} · {payment.amount.toFixed(2)}</span>)}
      </div> : null}

      {hasBillSplits && paymentReady ? <div className="checkout-guidance">تم تقسيم الفاتورة؛ التحصيل يتم من الفواتير المقسمة حتى لا يحدث دفع مزدوج.</div> : null}

      {canPay && paymentReady && !hasBillSplits && remainingAmount > 0 ? <div className="checkout-payment-area">
        <div className="checkout-methods" role="group" aria-label="طريقة الدفع">
          <button type="button" className={method === 'cash' ? 'active' : ''} onClick={() => { setMethod('cash'); setCashReceived(amount || remainingAmount.toFixed(2)) }}>نقدي</button>
          <button type="button" className={method === 'card' ? 'active' : ''} onClick={() => setMethod('card')}>بطاقة</button>
        </div>

        <label className="checkout-field"><span>قيمة الدفعة</span><input type="number" min="0.01" step="0.01" max={remainingAmount} value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
        <div className="checkout-quick-amounts">
          <button type="button" onClick={() => setAmount(remainingAmount.toFixed(2))}>كامل المتبقي</button>
          {[0.25, 0.5].map((ratio) => <button key={ratio} type="button" onClick={() => setAmount(Math.max(.01, Number((remainingAmount * ratio).toFixed(2))).toFixed(2))}>{ratio === .5 ? 'نصف' : 'ربع'}</button>)}
        </div>

        {method === 'cash' ? <div className="checkout-cash-grid">
          <label className="checkout-field"><span>المبلغ المستلم</span><input type="number" min={amountNumber || 0} step="0.01" value={cashReceived} onChange={(event) => setCashReceived(event.target.value)} /></label>
          <div className="checkout-change"><span>الباقي للعميل</span><strong>{change.toFixed(2)}</strong></div>
        </div> : null}

        <button className="checkout-submit" type="button" disabled={saving || !validAmount || !cashValid} onClick={() => void collect()}>{saving ? 'جارٍ التحصيل…' : `تحصيل ${amountNumber > 0 ? amountNumber.toFixed(2) : ''}`}</button>
        <small className="muted-text">يمكن تحصيل أكثر من دفعة بطرق مختلفة حتى يكتمل المتبقي؛ كل دفعة تستخدم عقد take_payment الحالي.</small>
      </div> : null}

      {order.status === 'paid' ? <div className="checkout-paid"><strong>تم سداد الطلب بالكامل.</strong>{canClose ? <button type="button" disabled={saving} onClick={() => void close()}>إغلاق الطلب</button> : null}</div> : null}
      {error ? <p className="error-text">{error}</p> : null}
    </section>
  )
}
