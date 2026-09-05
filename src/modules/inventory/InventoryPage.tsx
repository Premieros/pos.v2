import { useEffect, useMemo, useState } from 'react'
import { useBranch } from '../branches/useBranch'
import { usePermissions } from '../permissions/usePermissions'
import {
  createInventoryItem,
  createWarehouse,
  listInventoryBalances,
  listInventoryItems,
  listWarehouses,
  recordStockMovement,
  transferStock,
  type InventoryBalance,
  type InventoryItem,
  type Warehouse,
} from './inventory.service'

export function InventoryPage() {
  const { currentBranchId } = useBranch()
  const { can } = usePermissions()
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [items, setItems] = useState<InventoryItem[]>([])
  const [balances, setBalances] = useState<InventoryBalance[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canView = can('inventory.view')
  const canSetup = can('inventory.setup')
  const canReceive = can('inventory.receive')
  const canAdjust = can('inventory.adjust')
  const canWaste = can('inventory.waste')
  const canTransfer = can('inventory.transfer')

  async function refresh() {
    if (!currentBranchId || !canView) return
    setLoading(true)
    setError(null)
    try {
      const [nextWarehouses, nextItems, nextBalances] = await Promise.all([
        listWarehouses(currentBranchId),
        listInventoryItems(currentBranchId),
        listInventoryBalances(currentBranchId),
      ])
      setWarehouses(nextWarehouses)
      setItems(nextItems)
      setBalances(nextBalances)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل المخزون')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [currentBranchId, canView])

  const balanceByItem = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of balances) {
      map.set(row.inventory_item_id, (map.get(row.inventory_item_id) ?? 0) + row.quantity)
    }
    return map
  }, [balances])

  if (!currentBranchId || !canView) return null

  async function runAction(action: () => Promise<void>) {
    setError(null)
    try {
      await action()
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تنفيذ العملية')
    }
  }

  async function handleWarehouseSubmit(form: HTMLFormElement) {
    const data = new FormData(form)
    await runAction(async () => {
      await createWarehouse({
        branchId: currentBranchId,
        code: String(data.get('code') ?? ''),
        nameAr: String(data.get('nameAr') ?? ''),
      })
      form.reset()
    })
  }

  async function handleItemSubmit(form: HTMLFormElement) {
    const data = new FormData(form)
    await runAction(async () => {
      await createInventoryItem({
        branchId: currentBranchId,
        code: String(data.get('code') ?? ''),
        nameAr: String(data.get('nameAr') ?? ''),
        baseUnit: String(data.get('baseUnit') ?? ''),
        minimumLevel: Number(data.get('minimumLevel') ?? 0),
      })
      form.reset()
    })
  }

  async function handleMovementSubmit(form: HTMLFormElement, mode: 'receipt' | 'adjustment' | 'waste') {
    const data = new FormData(form)
    const rawQuantity = Number(data.get('quantity') ?? 0)
    const quantityDelta = mode === 'waste' ? -Math.abs(rawQuantity) : rawQuantity
    await runAction(async () => {
      await recordStockMovement({
        branchId: currentBranchId,
        warehouseId: String(data.get('warehouseId') ?? ''),
        inventoryItemId: String(data.get('inventoryItemId') ?? ''),
        movementType: mode,
        quantityDelta,
        idempotencyKey: crypto.randomUUID(),
        note: String(data.get('note') ?? ''),
      })
      form.reset()
    })
  }

  async function handleTransferSubmit(form: HTMLFormElement) {
    const data = new FormData(form)
    await runAction(async () => {
      await transferStock({
        branchId: currentBranchId,
        fromWarehouseId: String(data.get('fromWarehouseId') ?? ''),
        toWarehouseId: String(data.get('toWarehouseId') ?? ''),
        inventoryItemId: String(data.get('inventoryItemId') ?? ''),
        quantity: Number(data.get('quantity') ?? 0),
        idempotencyKey: crypto.randomUUID(),
        note: String(data.get('note') ?? ''),
      })
      form.reset()
    })
  }

  const renderWarehouseOptions = () => warehouses.filter((warehouse) => warehouse.is_active).map((warehouse) => (
    <option key={warehouse.id} value={warehouse.id}>{warehouse.name_ar}</option>
  ))

  const renderItemOptions = () => items.filter((item) => item.is_active).map((item) => (
    <option key={item.id} value={item.id}>{item.name_ar} — {item.base_unit}</option>
  ))

  return (
    <section className="workspace-card" aria-labelledby="inventory-title">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">INVENTORY</p>
          <h2 id="inventory-title">المخزون</h2>
          <p>الرصيد مشتق من سجل الحركات؛ لا يوجد تعديل مباشر للرصيد.</p>
        </div>
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {loading ? <p>جارٍ تحميل المخزون…</p> : null}

      {canSetup ? (
        <div className="inventory-setup-grid">
          <form className="inline-form" onSubmit={(event) => { event.preventDefault(); void handleWarehouseSubmit(event.currentTarget) }}>
            <h3>إضافة مخزن</h3>
            <input name="code" required placeholder="كود المخزن" />
            <input name="nameAr" required placeholder="اسم المخزن" />
            <button type="submit">إضافة مخزن</button>
          </form>

          <form className="inline-form" onSubmit={(event) => { event.preventDefault(); void handleItemSubmit(event.currentTarget) }}>
            <h3>إضافة عنصر مخزون</h3>
            <input name="code" required placeholder="الكود" />
            <input name="nameAr" required placeholder="الاسم" />
            <input name="baseUnit" required placeholder="الوحدة الأساسية مثل kg أو pcs" />
            <input name="minimumLevel" type="number" min="0" step="0.001" defaultValue="0" />
            <button type="submit">إضافة عنصر</button>
          </form>
        </div>
      ) : null}

      {(canReceive || canAdjust || canWaste || canTransfer) && warehouses.length > 0 && items.length > 0 ? (
        <div className="inventory-operations-grid">
          {canReceive ? (
            <form className="inline-form" onSubmit={(event) => { event.preventDefault(); void handleMovementSubmit(event.currentTarget, 'receipt') }}>
              <h3>استلام مخزون</h3>
              <select name="warehouseId" required defaultValue=""><option value="" disabled>المخزن</option>{renderWarehouseOptions()}</select>
              <select name="inventoryItemId" required defaultValue=""><option value="" disabled>العنصر</option>{renderItemOptions()}</select>
              <input name="quantity" type="number" min="0.000001" step="0.000001" required placeholder="الكمية" />
              <input name="note" placeholder="ملاحظة اختيارية" />
              <button type="submit">تسجيل الاستلام</button>
            </form>
          ) : null}

          {canAdjust ? (
            <form className="inline-form" onSubmit={(event) => { event.preventDefault(); void handleMovementSubmit(event.currentTarget, 'adjustment') }}>
              <h3>تسوية مخزون</h3>
              <select name="warehouseId" required defaultValue=""><option value="" disabled>المخزن</option>{renderWarehouseOptions()}</select>
              <select name="inventoryItemId" required defaultValue=""><option value="" disabled>العنصر</option>{renderItemOptions()}</select>
              <input name="quantity" type="number" step="0.000001" required placeholder="الفرق + أو -" />
              <input name="note" required placeholder="سبب التسوية" />
              <button type="submit">تنفيذ التسوية</button>
            </form>
          ) : null}

          {canWaste ? (
            <form className="inline-form" onSubmit={(event) => { event.preventDefault(); void handleMovementSubmit(event.currentTarget, 'waste') }}>
              <h3>تسجيل هالك</h3>
              <select name="warehouseId" required defaultValue=""><option value="" disabled>المخزن</option>{renderWarehouseOptions()}</select>
              <select name="inventoryItemId" required defaultValue=""><option value="" disabled>العنصر</option>{renderItemOptions()}</select>
              <input name="quantity" type="number" min="0.000001" step="0.000001" required placeholder="الكمية" />
              <input name="note" required placeholder="سبب الهالك" />
              <button type="submit">تسجيل الهالك</button>
            </form>
          ) : null}

          {canTransfer ? (
            <form className="inline-form" onSubmit={(event) => { event.preventDefault(); void handleTransferSubmit(event.currentTarget) }}>
              <h3>تحويل بين المخازن</h3>
              <select name="fromWarehouseId" required defaultValue=""><option value="" disabled>من مخزن</option>{renderWarehouseOptions()}</select>
              <select name="toWarehouseId" required defaultValue=""><option value="" disabled>إلى مخزن</option>{renderWarehouseOptions()}</select>
              <select name="inventoryItemId" required defaultValue=""><option value="" disabled>العنصر</option>{renderItemOptions()}</select>
              <input name="quantity" type="number" min="0.000001" step="0.000001" required placeholder="الكمية" />
              <input name="note" placeholder="ملاحظة اختيارية" />
              <button type="submit">تنفيذ التحويل</button>
            </form>
          ) : null}
        </div>
      ) : null}

      <div className="inventory-summary">
        <div><strong>{warehouses.length}</strong><span>مخزن</span></div>
        <div><strong>{items.length}</strong><span>عنصر مخزون</span></div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>الكود</th>
              <th>العنصر</th>
              <th>الوحدة</th>
              <th>إجمالي الرصيد</th>
              <th>الحد الأدنى</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.code}</td>
                <td>{item.name_ar}</td>
                <td>{item.base_unit}</td>
                <td>{balanceByItem.get(item.id) ?? 0}</td>
                <td>{item.minimum_level}</td>
              </tr>
            ))}
            {!items.length && !loading ? <tr><td colSpan={5}>لا توجد عناصر مخزون بعد.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}
