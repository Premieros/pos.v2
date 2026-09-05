import { useEffect, useState } from 'react'
import type { PosOrder } from '../pos/pos.service'
import './receipt.css'
import { getReceiptPrintState, registerFirstReceiptPrint, registerReceiptReprint, type ReceiptPrintResult } from './receipt.service'

type Props = {
  order: PosOrder
  canPrint: boolean
  canReprint: boolean
}

export function ReceiptControls({ order, canPrint, canReprint }: Props) {
  const [hasReceipt, setHasReceipt] = useState(false)
  const [lastSequence, setLastSequence] = useState(0)
  const [result, setResult] = useState<ReceiptPrintResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refreshState() {
    try {
      const state = await getReceiptPrintState(order.id)
      setHasReceipt(state.hasReceipt)
      setLastSequence(state.lastSequence)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل حالة الإيصال')
    }
  }

  useEffect(() => {
    setResult(null)
    setError(null)
    void refreshState()
  }, [order.id])

  if (!canPrint && !canReprint) return null

  async function execute(action: () => Promise<ReceiptPrintResult>) {
    setBusy(true)
    setError(null)
    try {
      const next = await action()
      setResult(next)
      setHasReceipt(true)
      setLastSequence(next.sequence)
      window.setTimeout(() => window.print(), 80)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تجهيز الإيصال')
    } finally {
      setBusy(false)
    }
  }

  const printableState = ['paid', 'closed'].includes(order.status)

  return (
    <section className="receipt-controls" aria-label="طباعة الإيصال">
      <div className="receipt-actions">
        <div>
          <strong>الإيصال</strong>
          <p className="muted-text">أول طباعة تحفظ Snapshot ثابتًا، وإعادة الطباعة تستخدم نفس النسخة دون تعديل البيع.</p>
        </div>
        <div>
          {canPrint && !hasReceipt ? (
            <button type="button" disabled={busy || !printableState} onClick={() => void execute(() => registerFirstReceiptPrint(order.id))}>طباعة أولى</button>
          ) : null}
          {canReprint && hasReceipt ? (
            <button type="button" disabled={busy} onClick={() => {
              const reason = window.prompt('سبب إعادة الطباعة')
              if (reason?.trim()) void execute(() => registerReceiptReprint(order.id, reason))
            }}>إعادة طباعة #{lastSequence + 1}</button>
          ) : null}
        </div>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      {result ? (
        <article className="receipt-print-root" dir="rtl">
          <div className="receipt-paper">
            <h3>{result.snapshot.branch.name_ar}</h3>
            <p>{result.snapshot.branch.code}</p>
            <hr />
            <p>طلب #{result.snapshot.order.order_number}</p>
            <p>{new Date(result.snapshot.order.created_at).toLocaleString('ar-EG')}</p>
            <div className="receipt-lines">
              {result.snapshot.items.map((item) => (
                <div key={item.id}><span>{item.product_name} × {item.quantity}</span><strong>{Number(item.line_total).toFixed(2)}</strong></div>
              ))}
            </div>
            <hr />
            <p>الإجمالي قبل الخصم: {Number(result.snapshot.order.subtotal).toFixed(2)}</p>
            <p>الخصم: {Number(result.snapshot.order.discount_total).toFixed(2)}</p>
            <p><strong>الإجمالي: {Number(result.snapshot.order.total).toFixed(2)}</strong></p>
            <div className="receipt-lines">
              {result.snapshot.payments.map((payment) => <div key={payment.id}><span>{payment.method === 'cash' ? 'نقدي' : 'بطاقة'}</span><strong>{Number(payment.amount).toFixed(2)}</strong></div>)}
            </div>
            <hr />
            <small>{result.event_type === 'reprint' ? `إعادة طباعة رقم ${result.sequence}` : 'الطباعة الأولى'}</small>
          </div>
        </article>
      ) : null}
    </section>
  )
}
