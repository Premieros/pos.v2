import { useEffect, useState } from 'react'
import type { PosOrder, PosOrderItem } from '../pos/pos.service'
import { buildEqualSplits, createOrderBillSplits, listBillSplits, takeSplitPayment, type BillSplit } from './split.service'

export function SplitBillControls({ order, items, canSplit, canPay, onChanged, onSplitStateChange }: {
  order: PosOrder
  items: PosOrderItem[]
  canSplit: boolean
  canPay: boolean
  onChanged: () => Promise<void>
  onSplitStateChange: (hasSplits: boolean) => void
}) {
  const [splits, setSplits] = useState<BillSplit[]>([])
  const [parts, setParts] = useState(2)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    const next = await listBillSplits(order.id)
    setSplits(next)
    onSplitStateChange(next.length > 0)
  }

  useEffect(() => {
    void refresh().catch((cause) => setError(cause instanceof Error ? cause.message : 'تعذر تحميل تقسيم الفاتورة'))
  }, [order.id])

  async function createSplits() {
    setBusy(true)
    setError(null)
    try {
      await createOrderBillSplits(order.id, buildEqualSplits(items, parts))
      await refresh()
      await onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تقسيم الفاتورة')
    } finally {
      setBusy(false)
    }
  }

  async function pay(split: BillSplit, form: HTMLFormElement) {
    const data = new FormData(form)
    const method = String(data.get('method')) as 'cash' | 'card'
    const amount = Number(data.get('amount'))
    setBusy(true)
    setError(null)
    try {
      await takeSplitPayment(split.id, method, amount)
      form.reset()
      await refresh()
      await onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحصيل الفاتورة الفرعية')
    } finally {
      setBusy(false)
    }
  }

  if (!canSplit && !splits.length) return null

  return (
    <section className="split-bill-card">
      <div className="split-bill-header">
        <div>
          <strong>تقسيم الفاتورة</strong>
          <small>التقسيم مالي داخل نفس الطلب؛ لا ينشئ أوردر أو استهلاك مخزون جديد.</small>
        </div>
        {!splits.length && canSplit && order.status === 'ready' ? (
          <div className="split-create-controls">
            <select value={parts} onChange={(event) => setParts(Number(event.target.value))} aria-label="عدد الفواتير">
              {[2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count} فواتير</option>)}
            </select>
            <button type="button" disabled={busy} onClick={() => void createSplits()}>تقسيم بالتساوي</button>
          </div>
        ) : null}
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      {splits.length ? (
        <div className="split-grid">
          {splits.map((split) => (
            <div className="split-card" key={split.id}>
              <div>
                <strong>{split.label}</strong>
                <span>الإجمالي {split.total_amount.toFixed(2)}</span>
                <span>المدفوع {split.paid_amount.toFixed(2)}</span>
                <span>المتبقي {split.remaining_amount.toFixed(2)}</span>
              </div>
              {canPay && split.remaining_amount > 0 ? (
                <form className="split-payment-form" onSubmit={(event) => { event.preventDefault(); void pay(split, event.currentTarget) }}>
                  <select name="method" defaultValue="cash" aria-label={`طريقة دفع ${split.label}`}>
                    <option value="cash">نقدي</option>
                    <option value="card">بطاقة</option>
                  </select>
                  <input name="amount" type="number" min="0.01" step="0.01" max={split.remaining_amount} defaultValue={split.remaining_amount.toFixed(2)} required aria-label={`مبلغ ${split.label}`} />
                  <button type="submit" disabled={busy}>تحصيل</button>
                </form>
              ) : <strong className="split-paid">مدفوعة بالكامل</strong>}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}
