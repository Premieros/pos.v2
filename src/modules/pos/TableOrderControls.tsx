import { useMemo, useState } from 'react'
import '../../styles/table-order.css'
import { mergeDineInOrders, transferOrderTable, type DiningTable, type PosOrder } from './pos.service'

type Props = {
  order: PosOrder
  orders: PosOrder[]
  tables: DiningTable[]
  canTransfer: boolean
  onChanged: () => Promise<void>
}

export function TableOrderControls({ order, orders, tables, canTransfer, onChanged }: Props) {
  const [toTableId, setToTableId] = useState('')
  const [sourceOrderId, setSourceOrderId] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const occupied = useMemo(() => new Set(orders.filter((item) => item.id !== order.id && item.dining_table_id).map((item) => item.dining_table_id as string)), [orders, order.id])
  const transferTargets = useMemo(() => tables.filter((table) => table.id !== order.dining_table_id && !occupied.has(table.id)), [tables, occupied, order.dining_table_id])
  const mergeSources = useMemo(() => orders.filter((item) => item.id !== order.id && item.order_type === 'dine_in' && ['created', 'held', 'sent_to_kitchen', 'preparing', 'ready'].includes(item.status)), [orders, order.id])

  if (!canTransfer || order.order_type !== 'dine_in') return null

  async function run(action: () => Promise<unknown>) {
    setError(null)
    setBusy(true)
    try {
      await action()
      setToTableId('')
      setSourceOrderId('')
      setReason('')
      await onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تنفيذ حركة الطاولة')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="table-order-controls" aria-label="نقل ودمج الطاولات">
      <div>
        <strong>نقل / دمج الطاولة</strong>
        <p className="muted-text">النقل لا يغير الطلب أو المدفوعات. الدمج يحافظ على الطلب المصدر كسجل ويُرفض إذا بدأ الدفع أو وُجد Split/Return.</p>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="سبب النقل أو الدمج" aria-label="سبب حركة الطاولة" />

      <div className="table-order-grid">
        <div>
          <select value={toTableId} onChange={(event) => setToTableId(event.target.value)} aria-label="الطاولة الجديدة">
            <option value="">اختر طاولة متاحة</option>
            {transferTargets.map((table) => <option key={table.id} value={table.id}>{table.name} · {table.code}</option>)}
          </select>
          <button type="button" disabled={busy || !toTableId || reason.trim().length < 2} onClick={() => void run(() => transferOrderTable(order.id, toTableId, reason))}>نقل الطلب</button>
        </div>

        <div>
          <select value={sourceOrderId} onChange={(event) => setSourceOrderId(event.target.value)} aria-label="الطلب المراد دمجه">
            <option value="">اختر طلب صالة للدمج</option>
            {mergeSources.map((item) => <option key={item.id} value={item.id}>#{item.order_number} · {item.status}</option>)}
          </select>
          <button type="button" disabled={busy || !sourceOrderId || reason.trim().length < 2} onClick={() => void run(() => mergeDineInOrders(order.id, sourceOrderId, reason))}>دمج في الطلب الحالي</button>
        </div>
      </div>
    </section>
  )
}
