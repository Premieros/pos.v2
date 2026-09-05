import { useEffect, useMemo, useState } from 'react'
import { useBranch } from '../branches/useBranch'
import { usePermissions } from '../permissions/usePermissions'
import { listPosWarehouses, type PosWarehouse } from '../pos/pos.service'
import {
  allocateRefund,
  estimateReturnTotal,
  listRefundSources,
  listReturnableItems,
  listReturnableOrders,
  returnOrder,
  type RefundSource,
  type ReturnableItem,
  type ReturnableOrder,
} from './return.service'

export function ReturnPanel() {
  const { currentBranchId } = useBranch()
  const { can } = usePermissions()
  const [orders, setOrders] = useState<ReturnableOrder[]>([])
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [items, setItems] = useState<ReturnableItem[]>([])
  const [sources, setSources] = useState<RefundSource[]>([])
  const [warehouses, setWarehouses] = useState<PosWarehouse[]>([])
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [restock, setRestock] = useState<Record<string, boolean>>({})
  const [warehouseByItem, setWarehouseByItem] = useState<Record<string, string>>({})
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const canReturn = can('pos.order.return') && can('pos.payment.refund')
  const selectedOrder = useMemo(() => orders.find((order) => order.id === selectedOrderId) ?? null, [orders, selectedOrderId])
  const returnTotal = useMemo(() => selectedOrder ? estimateReturnTotal(selectedOrder, items, quantities) : 0, [selectedOrder, items, quantities])
  const availableRefund = useMemo(() => sources.reduce((sum, source) => sum + source.available_amount, 0), [sources])

  async function loadOrders() {
    if (!currentBranchId || !canReturn) return
    const [nextOrders, nextWarehouses] = await Promise.all([listReturnableOrders(currentBranchId), listPosWarehouses(currentBranchId)])
    setOrders(nextOrders)
    setWarehouses(nextWarehouses)
    setSelectedOrderId((current) => nextOrders.some((order) => order.id === current) ? current : nextOrders[0]?.id ?? '')
  }

  async function loadOrder(orderId: string) {
    if (!orderId) {
      setItems([])
      setSources([])
      return
    }
    const [nextItems, nextSources] = await Promise.all([listReturnableItems(orderId), listRefundSources(orderId)])
    setItems(nextItems)
    setSources(nextSources)
    setQuantities({})
    setRestock({})
    setWarehouseByItem({})
  }

  useEffect(() => {
    if (!currentBranchId || !canReturn) return
    void loadOrders().catch((cause) => setError(cause instanceof Error ? cause.message : 'تعذر تحميل المرتجعات'))
  }, [currentBranchId, canReturn])

  useEffect(() => {
    void loadOrder(selectedOrderId).catch((cause) => setError(cause instanceof Error ? cause.message : 'تعذر تحميل تفاصيل الطلب'))
  }, [selectedOrderId])

  if (!currentBranchId || !canReturn) return null

  async function submitReturn() {
    if (!selectedOrder) return
    setBusy(true)
    setError(null)
    try {
      const lines = items.flatMap((item) => {
        const quantity = Number(quantities[item.id] ?? 0)
        if (quantity <= 0) return []
        const shouldRestock = Boolean(restock[item.id])
        return [{
          order_item_id: item.id,
          quantity,
          restock: shouldRestock,
          warehouse_id: shouldRestock ? warehouseByItem[item.id] || null : null,
        }]
      })
      if (!lines.length) throw new Error('اختر كمية مرتجع واحدة على الأقل')
      if (!reason.trim()) throw new Error('سبب المرتجع مطلوب')
      if (returnTotal <= 0) throw new Error('قيمة المرتجع غير صالحة')
      const refunds = allocateRefund(returnTotal, sources)
      await returnOrder({ orderId: selectedOrder.id, lines, refunds, reason })
      setReason('')
      await loadOrders()
      await loadOrder(selectedOrder.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تنفيذ المرتجع')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="workspace-card return-panel" aria-labelledby="return-title">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">Returns</p>
          <h2 id="return-title">المرتجعات ورد المدفوعات</h2>
          <p>المرتجع يعيد المال إلى نفس وسائل الدفع الأصلية. إعادة المخزون اختيارية لكل سطر ولا تتم تلقائيًا.</p>
        </div>
        <select aria-label="طلب المرتجع" value={selectedOrderId} onChange={(event) => setSelectedOrderId(event.target.value)}>
          <option value="">اختر طلبًا</option>
          {orders.map((order) => <option key={order.id} value={order.id}>#{order.order_number} · {order.status} · {order.total.toFixed(2)}</option>)}
        </select>
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {!orders.length ? <p>لا توجد طلبات مدفوعة أو مغلقة قابلة للمرتجع.</p> : null}

      {selectedOrder ? (
        <>
          <div className="return-lines">
            {items.map((item) => {
              const maxQuantity = Math.max(0, item.quantity - item.returned_quantity)
              return (
                <div key={item.id} className="return-line">
                  <div>
                    <strong>{item.product_name}</strong>
                    <small>مباع {item.quantity} · مرتجع سابق {item.returned_quantity} · متاح {maxQuantity}</small>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={maxQuantity}
                    step="0.001"
                    value={quantities[item.id] ?? 0}
                    onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: Math.min(maxQuantity, Math.max(0, Number(event.target.value))) }))}
                    aria-label={`كمية مرتجع ${item.product_name}`}
                    disabled={maxQuantity <= 0}
                  />
                  <label className="return-restock">
                    <input
                      type="checkbox"
                      checked={Boolean(restock[item.id])}
                      onChange={(event) => setRestock((current) => ({ ...current, [item.id]: event.target.checked }))}
                      disabled={maxQuantity <= 0}
                    />
                    إعادة للمخزون
                  </label>
                  {restock[item.id] ? (
                    <select
                      value={warehouseByItem[item.id] ?? ''}
                      onChange={(event) => setWarehouseByItem((current) => ({ ...current, [item.id]: event.target.value }))}
                      aria-label={`مخزن مرتجع ${item.product_name}`}
                    >
                      <option value="">اختر المخزن</option>
                      {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name_ar}</option>)}
                    </select>
                  ) : <span>بدون Restock</span>}
                </div>
              )
            })}
          </div>

          <div className="return-summary">
            <span>قيمة المرتجع التقديرية: <strong>{returnTotal.toFixed(2)}</strong></span>
            <span>المتاح للرد من المدفوعات: <strong>{availableRefund.toFixed(2)}</strong></span>
            <span>{sources.map((source) => `${source.method === 'cash' ? 'نقدي' : 'بطاقة'} ${source.available_amount.toFixed(2)}`).join(' · ') || 'لا توجد مدفوعات متاحة'}</span>
          </div>

          <div className="inline-form return-submit">
            <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="سبب المرتجع" aria-label="سبب المرتجع" />
            <button type="button" disabled={busy || returnTotal <= 0 || returnTotal > availableRefund} onClick={() => void submitReturn()}>
              {busy ? 'جارٍ التنفيذ…' : 'تنفيذ المرتجع ورد المبلغ'}
            </button>
          </div>
          {sources.some((source) => source.method === 'cash' && source.available_amount > 0) ? <p className="muted-text">أي جزء نقدي من المرتجع يتطلب وردية مفتوحة للمستخدم الحالي ويُسجل Cash Out تلقائيًا.</p> : null}
        </>
      ) : null}
    </section>
  )
}
