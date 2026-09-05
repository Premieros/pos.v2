import { useEffect, useMemo, useState } from 'react'
import { useBranch } from '../branches/useBranch'
import { usePermissions } from '../permissions/usePermissions'
import {
  createInventoryItem,
  createWarehouse,
  listInventoryBalances,
  listInventoryItems,
  listWarehouses,
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

  async function handleWarehouseSubmit(form: HTMLFormElement) {
    const data = new FormData(form)
    await createWarehouse({
      branchId: currentBranchId!,
      code: String(data.get('code') ?? ''),
      nameAr: String(data.get('nameAr') ?? ''),
    })
    form.reset()
    await refresh()
  }

  async function handleItemSubmit(form: HTMLFormElement) {
    const data = new FormData(form)
    await createInventoryItem({
      branchId: currentBranchId!,
      code: String(data.get('code') ?? ''),
      nameAr: String(data.get('nameAr') ?? ''),
      baseUnit: String(data.get('baseUnit') ?? ''),
      minimumLevel: Number(data.get('minimumLevel') ?? 0),
    })
    form.reset()
    await refresh()
  }

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
          <form
            className="inline-form"
            onSubmit={(event) => {
              event.preventDefault()
              void handleWarehouseSubmit(event.currentTarget)
            }}
          >
            <h3>إضافة مخزن</h3>
            <input name="code" required placeholder="كود المخزن" />
            <input name="nameAr" required placeholder="اسم المخزن" />
            <button type="submit">إضافة مخزن</button>
          </form>

          <form
            className="inline-form"
            onSubmit={(event) => {
              event.preventDefault()
              void handleItemSubmit(event.currentTarget)
            }}
          >
            <h3>إضافة عنصر مخزون</h3>
            <input name="code" required placeholder="الكود" />
            <input name="nameAr" required placeholder="الاسم" />
            <input name="baseUnit" required placeholder="الوحدة الأساسية مثل kg أو pcs" />
            <input name="minimumLevel" type="number" min="0" step="0.001" defaultValue="0" />
            <button type="submit">إضافة عنصر</button>
          </form>
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
            {!items.length && !loading ? (
              <tr><td colSpan={5}>لا توجد عناصر مخزون بعد.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}
