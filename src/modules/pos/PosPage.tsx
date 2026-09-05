import { useEffect, useMemo, useState } from 'react'
import { useBranch } from '../branches/useBranch'
import { CustomerDisplayControls } from '../customer-display/CustomerDisplayControls'
import { OrderDiscountControls } from '../discounts/OrderDiscountControls'
import { usePayments } from '../payments/usePayments'
import { usePermissions } from '../permissions/usePermissions'
import { ReceiptControls } from '../receipts/ReceiptControls'
import { SplitBillControls } from '../splits/SplitBillControls'
import { TableOrderControls } from './TableOrderControls'
import {
  addPosOrderItem,
  cancelPosOrder,
  countKitchenQueue,
  createDiningTable,
  createPosOrder,
  hasOwnOpenShift,
  holdPosOrder,
  listActiveOrders,
  listDiningTables,
  listOrderItems,
  listPosProducts,
  listPosWarehouses,
  removePosOrderItem,
  resumePosOrder,
  sendOrderToKitchen,
  setPosOrderItemQuantity,
  voidPosOrder,
  type DiningTable,
  type PosOrder,
  type PosOrderItem,
  type PosOrderType,
  type PosProduct,
  type PosWarehouse,
} from './pos.service'

const orderTypeLabels: Record<PosOrderType, string> = {
  dine_in: 'صالة',
  take_away: 'تيك أواي',
  drive_thru: 'درايف ثرو',
  delivery: 'دليفري',
  quick: 'طلب سريع',
}

export function PosPage() {
  const { currentBranchId } = useBranch()
  const { can } = usePermissions()
  const [products, setProducts] = useState<PosProduct[]>([])
  const [warehouses, setWarehouses] = useState<PosWarehouse[]>([])
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('')
  const [tables, setTables] = useState<DiningTable[]>([])
  const [orders, setOrders] = useState<PosOrder[]>([])
  const [items, setItems] = useState<PosOrderItem[]>([])
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [hasBillSplits, setHasBillSplits] = useState(false)
  const [kitchenQueueCount, setKitchenQueueCount] = useState(0)
  const [hasShift, setHasShift] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canView = can('pos.view')
  const canCreate = can('pos.order.create')
  const canEdit = can('pos.order.edit')
  const canCancel = can('pos.order.cancel')
  const canVoid = can('pos.order.void')
  const canSendKitchen = can('pos.send_kitchen')
  const canPay = can('pos.payment.take')
  const canClose = can('pos.order.close')
  const canDiscount = can('pos.discount.apply')
  const canSplit = can('pos.order.split')
  const canTransfer = can('pos.order.transfer')
  const canPrintReceipt = can('pos.receipt.print')
  const canReprintReceipt = can('pos.receipt.reprint')
  const canManageTables = can('pos.tables.manage')
  const branchId = currentBranchId

  const selectedOrder = useMemo(() => orders.find((order) => order.id === selectedOrderId) ?? null, [orders, selectedOrderId])
  const occupiedTableIds = useMemo(() => new Set(orders.filter((order) => order.dining_table_id).map((order) => order.dining_table_id as string)), [orders])
  const hasKitchenDelta = useMemo(() => items.some((item) => (item.is_removed ? 0 : item.quantity) !== item.sent_quantity), [items])
  const hasBeenSent = useMemo(() => items.some((item) => item.sent_quantity !== 0), [items])

  const { payments, paidAmount, remainingAmount, refreshPayments, takePayment, closePaidOrder } = usePayments(selectedOrder)

  async function refreshAll() {
    if (!branchId || !canView) return
    setLoading(true)
    setError(null)
    try {
      const [nextProducts, nextWarehouses, nextTables, nextOrders, openShift, queueCount] = await Promise.all([
        listPosProducts(branchId),
        listPosWarehouses(branchId),
        listDiningTables(branchId),
        listActiveOrders(branchId),
        hasOwnOpenShift(branchId),
        countKitchenQueue(branchId),
      ])
      setProducts(nextProducts)
      setWarehouses(nextWarehouses)
      setTables(nextTables)
      setOrders(nextOrders)
      setHasShift(openShift)
      setKitchenQueueCount(queueCount)
      setSelectedWarehouseId((current) => nextWarehouses.some((warehouse) => warehouse.id === current) ? current : nextWarehouses[0]?.id ?? '')
      if (selectedOrderId && !nextOrders.some((order) => order.id === selectedOrderId)) setSelectedOrderId(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل شاشة البيع')
    } finally {
      setLoading(false)
    }
  }

  async function refreshItems(orderId: string | null) {
    if (!orderId) {
      setItems([])
      return
    }
    try {
      setItems(await listOrderItems(orderId))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل عناصر الطلب')
    }
  }

  useEffect(() => { void refreshAll() }, [branchId, canView])
  useEffect(() => { void refreshItems(selectedOrderId) }, [selectedOrderId])
  useEffect(() => { setHasBillSplits(false) }, [selectedOrderId])

  if (!branchId || !canView) return null
  const activeBranchId = branchId

  async function runAction(action: () => Promise<void>) {
    setError(null)
    try {
      await action()
      await refreshAll()
      await refreshItems(selectedOrderId)
      await refreshPayments()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تنفيذ العملية')
    }
  }

  async function refreshOrderState() {
    await refreshAll()
    await refreshItems(selectedOrderId)
    await refreshPayments()
  }

  async function handleCreateOrder(form: HTMLFormElement) {
    const data = new FormData(form)
    const orderType = String(data.get('orderType')) as PosOrderType
    const diningTableId = String(data.get('diningTableId') ?? '') || null
    const guestCount = Number(data.get('guestCount') ?? 1)
    await runAction(async () => {
      const id = await createPosOrder({ branchId: activeBranchId, orderType, diningTableId, guestCount })
      setSelectedOrderId(id)
      form.reset()
    })
  }

  async function handleCreateTable(form: HTMLFormElement) {
    const data = new FormData(form)
    await runAction(async () => {
      await createDiningTable({
        branchId: activeBranchId,
        code: String(data.get('code') ?? ''),
        name: String(data.get('name') ?? ''),
        capacity: Number(data.get('capacity') ?? 4),
        floorName: String(data.get('floorName') ?? ''),
      })
      form.reset()
    })
  }

  async function handlePayment(form: HTMLFormElement) {
    if (!selectedOrder) return
    const data = new FormData(form)
    const method = String(data.get('method')) as 'cash' | 'card'
    const amount = Number(data.get('amount'))
    await runAction(async () => {
      await takePayment(method, amount)
      form.reset()
    })
  }

  const editable = selectedOrder && ['created', 'held', 'sent_to_kitchen', 'preparing'].includes(selectedOrder.status)
  const cancellable = selectedOrder && ['created', 'held'].includes(selectedOrder.status)
  const voidable = selectedOrder && ['sent_to_kitchen', 'preparing', 'ready'].includes(selectedOrder.status) && payments.length === 0
  const kitchenSendable = selectedOrder && ['created', 'sent_to_kitchen', 'preparing'].includes(selectedOrder.status)
  const paymentReady = selectedOrder && ['ready', 'partially_paid'].includes(selectedOrder.status)

  return (
    <section className="workspace-card pos-workspace" aria-labelledby="pos-title">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">POS</p>
          <h2 id="pos-title">شاشة البيع</h2>
          <p>تعديلات الطلب بعد الإرسال تبقى محلية حتى تضغط «إرسال التغييرات» للمطبخ، والدفع منفصل عن إنشاء الطلب.</p>
        </div>
        <div className="pos-counters">
          <span>مفتوحة: {orders.length}</span>
          <span>طاولات مشغولة: {occupiedTableIds.size}</span>
          <span>Held: {orders.filter((order) => order.status === 'held').length}</span>
          <span>طابور KDS: {kitchenQueueCount}</span>
        </div>
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {loading ? <p>جارٍ تحميل شاشة البيع…</p> : null}

      {!hasShift ? (
        <div className="prerequisite-card">
          <strong>يجب فتح وردية قبل إنشاء طلب.</strong>
          <p>استخدم قسم الورديات لفتح ورديتك ثم عد إلى شاشة البيع.</p>
        </div>
      ) : null}

      {canSendKitchen && !warehouses.length ? (
        <div className="prerequisite-card">
          <strong>لا يوجد مخزن نشط للإرسال للمطبخ.</strong>
          <p>أنشئ مخزنًا من قسم المخزون أولًا؛ لن يتم خصم أي مخزون بصورة عشوائية.</p>
        </div>
      ) : null}

      <div className="pos-layout">
        <aside className="pos-orders-panel">
          <h3>الطلبات الحالية</h3>
          <div className="plain-list">
            {orders.map((order) => (
              <button key={order.id} type="button" className={selectedOrderId === order.id ? 'selected-row' : ''} onClick={() => setSelectedOrderId(order.id)}>
                #{order.order_number} · {orderTypeLabels[order.order_type]} · {order.status} · {order.total.toFixed(2)}
              </button>
            ))}
            {!orders.length ? <p>لا توجد طلبات مفتوحة.</p> : null}
          </div>
        </aside>

        <div className="pos-main-panel">
          {canCreate ? (
            <form className="pos-create-order" onSubmit={(event) => { event.preventDefault(); void handleCreateOrder(event.currentTarget) }}>
              <select name="orderType" required defaultValue="quick">
                {Object.entries(orderTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <select name="diningTableId" defaultValue="">
                <option value="">بدون طاولة</option>
                {tables.map((table) => <option key={table.id} value={table.id} disabled={occupiedTableIds.has(table.id)}>{table.name} · {table.capacity} مقاعد{occupiedTableIds.has(table.id) ? ' · مشغولة' : ''}</option>)}
              </select>
              <input name="guestCount" type="number" min="0" defaultValue="1" />
              <button type="submit" disabled={!hasShift}>إنشاء طلب</button>
            </form>
          ) : null}

          {canManageTables ? (
            <details className="pos-table-setup">
              <summary>إعداد طاولة</summary>
              <form className="inline-form" onSubmit={(event) => { event.preventDefault(); void handleCreateTable(event.currentTarget) }}>
                <input name="code" required placeholder="كود الطاولة" />
                <input name="name" required placeholder="اسم الطاولة" />
                <input name="floorName" placeholder="الدور/المنطقة" />
                <input name="capacity" type="number" min="1" defaultValue="4" required />
                <button type="submit">إضافة طاولة</button>
              </form>
            </details>
          ) : null}

          {selectedOrder ? (
            <div className="active-order-card">
              <div className="active-order-header">
                <div>
                  <h3>طلب #{selectedOrder.order_number}</h3>
                  <p>{orderTypeLabels[selectedOrder.order_type]} · {selectedOrder.status}</p>
                </div>
                <strong>{selectedOrder.total.toFixed(2)}</strong>
              </div>

              <div className="order-items-list">
                {items.filter((item) => !item.is_removed).map((item) => (
                  <div key={item.id} className="order-item-row">
                    <span>{item.product_name}</span>
                    <span>{item.unit_price.toFixed(2)}</span>
                    {canEdit && editable ? (
                      <input
                        aria-label={`كمية ${item.product_name}`}
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={item.quantity}
                        onChange={(event) => {
                          const quantity = Number(event.target.value)
                          if (quantity > 0) void runAction(() => setPosOrderItemQuantity(item.id, quantity))
                        }}
                      />
                    ) : <span>{item.quantity}</span>}
                    <strong>{item.line_total.toFixed(2)}</strong>
                    {canEdit && editable ? <button type="button" onClick={() => void runAction(() => removePosOrderItem(item.id))}>حذف</button> : null}
                  </div>
                ))}
                {!items.filter((item) => !item.is_removed).length ? <p>لم تتم إضافة منتجات بعد.</p> : null}
              </div>

              <div className="pos-actions">
                {canEdit && selectedOrder.status === 'created' ? <button type="button" onClick={() => void runAction(() => holdPosOrder(selectedOrder.id))}>Hold</button> : null}
                {canEdit && selectedOrder.status === 'held' ? <button type="button" onClick={() => void runAction(() => resumePosOrder(selectedOrder.id))}>Resume</button> : null}
                {canCancel && cancellable ? <button type="button" onClick={() => { const reason = window.prompt('سبب الإلغاء قبل المطبخ'); if (reason) void runAction(() => cancelPosOrder(selectedOrder.id, reason)) }}>إلغاء الطلب</button> : null}
                {canVoid && voidable ? <button type="button" onClick={() => { const reason = window.prompt('سبب إلغاء الطلب بعد المطبخ (Void)'); if (reason) void runAction(async () => { await voidPosOrder(selectedOrder.id, reason) }) }}>Void بعد المطبخ</button> : null}

                {canSendKitchen && kitchenSendable ? (
                  <div className="kitchen-send-controls">
                    <select aria-label="مخزن خصم المطبخ" value={selectedWarehouseId} onChange={(event) => setSelectedWarehouseId(event.target.value)} disabled={!warehouses.length}>
                      {!warehouses.length ? <option value="">لا يوجد مخزن</option> : null}
                      {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name_ar}</option>)}
                    </select>
                    <button type="button" disabled={!selectedWarehouseId || !hasKitchenDelta} onClick={() => void runAction(async () => { await sendOrderToKitchen(selectedOrder.id, selectedWarehouseId) })}>
                      {hasBeenSent ? 'إرسال التغييرات' : 'إرسال للمطبخ'}
                    </button>
                    <span className={hasKitchenDelta ? 'pending-delta' : 'synced-delta'}>
                      {hasKitchenDelta ? 'توجد تغييرات غير مرسلة' : 'المطبخ متزامن'}
                    </span>
                  </div>
                ) : null}
              </div>

              <OrderDiscountControls
                order={selectedOrder}
                canApply={canDiscount}
                paymentStarted={payments.length > 0 || ['partially_paid', 'paid', 'closed'].includes(selectedOrder.status)}
                onChanged={refreshOrderState}
              />

              <SplitBillControls
                order={selectedOrder}
                items={items}
                canSplit={canSplit}
                canPay={canPay}
                onChanged={refreshOrderState}
                onSplitStateChange={setHasBillSplits}
              />

              <TableOrderControls order={selectedOrder} orders={orders} tables={tables} canTransfer={canTransfer} onChanged={refreshOrderState} />

              <ReceiptControls order={selectedOrder} canPrint={canPrintReceipt} canReprint={canReprintReceipt} />

              <CustomerDisplayControls order={selectedOrder} />

              {(canPay && paymentReady) || payments.length || selectedOrder.status === 'paid' ? (
                <div className="payment-card">
                  <div className="payment-summary">
                    <span>الإجمالي: <strong>{selectedOrder.total.toFixed(2)}</strong></span>
                    <span>المدفوع: <strong>{paidAmount.toFixed(2)}</strong></span>
                    <span>المتبقي: <strong>{remainingAmount.toFixed(2)}</strong></span>
                  </div>

                  {payments.length ? (
                    <div className="payment-history">
                      {payments.map((payment) => <span key={payment.id}>{payment.method === 'cash' ? 'نقدي' : 'بطاقة'} · {payment.amount.toFixed(2)}</span>)}
                    </div>
                  ) : null}

                  {hasBillSplits && paymentReady ? <p className="muted-text">يتم التحصيل من الفواتير المقسمة أعلاه.</p> : null}

                  {canPay && paymentReady && !hasBillSplits ? (
                    <form className="payment-form" onSubmit={(event) => { event.preventDefault(); void handlePayment(event.currentTarget) }}>
                      <select name="method" defaultValue="cash" aria-label="طريقة الدفع">
                        <option value="cash">نقدي</option>
                        <option value="card">بطاقة</option>
                      </select>
                      <input name="amount" type="number" min="0.01" step="0.01" max={remainingAmount} defaultValue={remainingAmount > 0 ? remainingAmount.toFixed(2) : ''} required aria-label="مبلغ الدفع" />
                      <button type="submit" disabled={remainingAmount <= 0}>تحصيل</button>
                    </form>
                  ) : null}

                  {canClose && selectedOrder.status === 'paid' ? (
                    <button type="button" onClick={() => void runAction(async () => { await closePaidOrder() })}>إغلاق الطلب</button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : <p>اختر طلبًا أو أنشئ طلبًا جديدًا.</p>}

          <div className="pos-products-scroll" aria-label="المنتجات">
            {products.map((product) => (
              <button
                key={product.id}
                type="button"
                className="product-tile"
                disabled={!selectedOrder || !canEdit || !editable}
                onClick={() => selectedOrder && void runAction(() => addPosOrderItem(selectedOrder.id, product.id, 1).then(() => undefined))}
              >
                <strong>{product.name_ar}</strong>
                <span>{product.sale_price.toFixed(2)}</span>
              </button>
            ))}
            {!products.length ? <p>لا توجد منتجات نشطة.</p> : null}
          </div>
        </div>
      </div>
    </section>
  )
}
