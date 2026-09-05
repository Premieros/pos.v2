import { useEffect, useMemo, useState } from 'react'
import { useBranch } from '../branches/useBranch'
import { listInventoryItems, type InventoryItem } from '../inventory/inventory.service'
import { usePermissions } from '../permissions/usePermissions'
import { listSuppliers, type Supplier } from './supplier.service'
import {
  addPurchaseOrderLine,
  createPurchaseOrder,
  listPurchaseOrderLines,
  listPurchaseOrders,
  removePurchaseOrderLine,
  updatePurchaseOrderLine,
  type PurchaseOrder,
  type PurchaseOrderLine,
} from './purchase.service'
import './purchases.css'

const statusLabel: Record<PurchaseOrder['status'], string> = {
  draft: 'مسودة',
  submitted: 'مرسل',
  partially_received: 'استلام جزئي',
  received: 'مستلم',
  cancelled: 'ملغي',
}

export function PurchasesPage() {
  const { currentBranchId } = useBranch()
  const { can } = usePermissions()
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [lines, setLines] = useState<PurchaseOrderLine[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canView = can('procurement.purchases.view') || can('procurement.purchases.create') || can('procurement.purchases.edit') || can('procurement.purchases.receive')
  const canCreate = can('procurement.purchases.create')
  const canEdit = can('procurement.purchases.edit')
  const branchId = currentBranchId

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) ?? null,
    [orders, selectedOrderId],
  )

  const supplierById = useMemo(() => new Map(suppliers.map((supplier) => [supplier.id, supplier])), [suppliers])
  const inventoryById = useMemo(() => new Map(inventoryItems.map((item) => [item.id, item])), [inventoryItems])

  async function refreshOrders() {
    if (!branchId || !canView) return
    const next = await listPurchaseOrders(branchId)
    setOrders(next)
    setSelectedOrderId((current) => current && next.some((order) => order.id === current) ? current : next[0]?.id ?? null)
  }

  async function refreshReferences() {
    if (!branchId || !canView) return
    const [nextSuppliers, nextItems] = await Promise.all([
      listSuppliers(branchId),
      listInventoryItems(branchId),
    ])
    setSuppliers(nextSuppliers.filter((supplier) => supplier.is_active))
    setInventoryItems(nextItems.filter((item) => item.is_active))
  }

  async function refreshAll() {
    if (!branchId || !canView) return
    setLoading(true)
    setError(null)
    try {
      await Promise.all([refreshOrders(), refreshReferences()])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل المشتريات')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refreshAll() }, [branchId, canView])

  useEffect(() => {
    if (!selectedOrderId) {
      setLines([])
      return
    }
    void (async () => {
      try {
        setLines(await listPurchaseOrderLines(selectedOrderId))
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'تعذر تحميل بنود أمر الشراء')
      }
    })()
  }, [selectedOrderId])

  if (!branchId || !canView) return null

  async function handleCreate(form: HTMLFormElement) {
    const data = new FormData(form)
    const supplierId = String(data.get('supplierId') ?? '')
    if (!supplierId) return
    setError(null)
    try {
      const id = await createPurchaseOrder({
        branchId,
        supplierId,
        notes: String(data.get('notes') ?? ''),
      })
      form.reset()
      await refreshOrders()
      setSelectedOrderId(id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر إنشاء أمر الشراء')
    }
  }

  async function handleAddLine(form: HTMLFormElement) {
    if (!selectedOrder || selectedOrder.status !== 'draft') return
    const data = new FormData(form)
    const quantity = Number(data.get('quantity'))
    const unitCost = Number(data.get('unitCost'))
    const inventoryItemId = String(data.get('inventoryItemId') ?? '')
    setError(null)
    try {
      await addPurchaseOrderLine({
        purchaseOrderId: selectedOrder.id,
        inventoryItemId,
        quantity,
        unitCost,
      })
      form.reset()
      setLines(await listPurchaseOrderLines(selectedOrder.id))
      await refreshOrders()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر إضافة البند')
    }
  }

  async function handleEditLine(line: PurchaseOrderLine) {
    if (!selectedOrder || selectedOrder.status !== 'draft') return
    const quantityText = window.prompt('الكمية المطلوبة', String(line.ordered_quantity))
    if (quantityText === null) return
    const costText = window.prompt('تكلفة الوحدة', String(line.unit_cost))
    if (costText === null) return
    setError(null)
    try {
      await updatePurchaseOrderLine({
        lineId: line.id,
        quantity: Number(quantityText),
        unitCost: Number(costText),
      })
      setLines(await listPurchaseOrderLines(selectedOrder.id))
      await refreshOrders()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تعديل البند')
    }
  }

  async function handleRemoveLine(line: PurchaseOrderLine) {
    if (!selectedOrder || selectedOrder.status !== 'draft') return
    if (!window.confirm('حذف هذا البند من أمر الشراء؟')) return
    setError(null)
    try {
      await removePurchaseOrderLine(line.id)
      setLines(await listPurchaseOrderLines(selectedOrder.id))
      await refreshOrders()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر حذف البند')
    }
  }

  return (
    <section className="workspace-card purchases-workspace" aria-labelledby="purchases-title">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">Procurement</p>
          <h2 id="purchases-title">أوامر الشراء</h2>
          <p>المورد، البنود، الكميات والتكلفة مرتبطة ببيانات الفرع الفعلية، والإجماليات تُحسب داخل قاعدة البيانات.</p>
        </div>
        <span>{orders.length} أمر شراء</span>
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {loading ? <p>جارٍ تحميل أوامر الشراء…</p> : null}

      {canCreate ? (
        <form className="purchase-create-form" onSubmit={(event) => { event.preventDefault(); void handleCreate(event.currentTarget) }}>
          <select name="supplierId" required defaultValue="">
            <option value="" disabled>اختر المورد</option>
            {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name_ar} — {supplier.code}</option>)}
          </select>
          <input name="notes" placeholder="ملاحظات أمر الشراء" />
          <button type="submit" disabled={!suppliers.length}>إنشاء أمر شراء</button>
        </form>
      ) : null}

      {!suppliers.length && canCreate ? <p className="muted-text">لا يوجد مورد نشط. أنشئ موردًا أولًا من قسم الموردين.</p> : null}
      {!inventoryItems.length && canEdit ? <p className="muted-text">لا توجد وحدات مخزون نشطة. أنشئ وحدة مخزون أولًا قبل إضافة البنود.</p> : null}

      <div className="purchase-layout">
        <aside className="purchase-order-list" aria-label="أوامر الشراء">
          {orders.map((order) => {
            const supplier = supplierById.get(order.supplier_id)
            return (
              <button
                key={order.id}
                type="button"
                className={order.id === selectedOrderId ? 'purchase-order-card is-active' : 'purchase-order-card'}
                onClick={() => setSelectedOrderId(order.id)}
              >
                <strong>#{order.purchase_number}</strong>
                <span>{supplier?.name_ar ?? 'مورد غير متاح'}</span>
                <span>{statusLabel[order.status]}</span>
                <span>{order.total.toFixed(2)}</span>
              </button>
            )
          })}
          {!loading && !orders.length ? <p className="muted-text">لا توجد أوامر شراء في هذا الفرع بعد.</p> : null}
        </aside>

        <div className="purchase-detail">
          {selectedOrder ? (
            <>
              <div className="purchase-summary">
                <div><span>أمر الشراء</span><strong>#{selectedOrder.purchase_number}</strong></div>
                <div><span>المورد</span><strong>{supplierById.get(selectedOrder.supplier_id)?.name_ar ?? '—'}</strong></div>
                <div><span>الحالة</span><strong>{statusLabel[selectedOrder.status]}</strong></div>
                <div><span>الإجمالي</span><strong>{selectedOrder.total.toFixed(2)}</strong></div>
              </div>

              {canEdit && selectedOrder.status === 'draft' ? (
                <form className="purchase-line-form" onSubmit={(event) => { event.preventDefault(); void handleAddLine(event.currentTarget) }}>
                  <select name="inventoryItemId" required defaultValue="">
                    <option value="" disabled>اختر وحدة المخزون</option>
                    {inventoryItems.map((item) => <option key={item.id} value={item.id}>{item.name_ar} — {item.base_unit}</option>)}
                  </select>
                  <input name="quantity" type="number" min="0.0001" step="0.0001" required placeholder="الكمية" />
                  <input name="unitCost" type="number" min="0" step="0.01" required placeholder="تكلفة الوحدة" />
                  <button type="submit" disabled={!inventoryItems.length}>إضافة بند</button>
                </form>
              ) : null}

              <div className="purchase-lines">
                <div className="purchase-line purchase-line-head">
                  <span>الصنف المخزني</span><span>المطلوب</span><span>المستلم</span><span>تكلفة الوحدة</span><span>الإجمالي</span><span>الإجراء</span>
                </div>
                {lines.map((line) => {
                  const item = inventoryById.get(line.inventory_item_id)
                  return (
                    <div className="purchase-line" key={line.id}>
                      <strong>{item?.name_ar ?? line.inventory_item_id}</strong>
                      <span>{line.ordered_quantity}</span>
                      <span>{line.received_quantity}</span>
                      <span>{line.unit_cost.toFixed(2)}</span>
                      <span>{line.line_total.toFixed(2)}</span>
                      <div>
                        {canEdit && selectedOrder.status === 'draft' ? <button type="button" onClick={() => void handleEditLine(line)}>تعديل</button> : null}
                        {canEdit && selectedOrder.status === 'draft' ? <button type="button" onClick={() => void handleRemoveLine(line)}>حذف</button> : null}
                      </div>
                    </div>
                  )
                })}
                {!lines.length ? <p className="muted-text">لا توجد بنود في هذا الأمر بعد.</p> : null}
              </div>
            </>
          ) : <p className="muted-text">اختر أمر شراء لعرض التفاصيل.</p>}
        </div>
      </div>
    </section>
  )
}
