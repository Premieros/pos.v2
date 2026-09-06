import { useEffect, useMemo, useState } from 'react'
import { useBranch } from '../branches/useBranch'
import { usePermissions } from '../permissions/usePermissions'
import {
  addProductComponent,
  createInventoryItem,
  createWarehouse,
  listInventoryBalances,
  listInventoryItems,
  listInventoryProducts,
  listProductComponents,
  listWarehouses,
  recordStockMovement,
  removeProductComponent,
  setProductInventoryItem,
  transferStock,
  type InventoryBalance,
  type InventoryItem,
  type InventoryProduct,
  type ProductComponent,
  type Warehouse,
} from './inventory.service'

export function InventoryPage() {
  const { currentBranchId } = useBranch()
  const { can } = usePermissions()
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [items, setItems] = useState<InventoryItem[]>([])
  const [balances, setBalances] = useState<InventoryBalance[]>([])
  const [products, setProducts] = useState<InventoryProduct[]>([])
  const [components, setComponents] = useState<ProductComponent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canView = can('inventory.view')
  const canSetup = can('inventory.setup')
  const canCatalogManage = can('catalog.manage')
  const canReceive = can('inventory.receive')
  const canAdjust = can('inventory.adjust')
  const canWaste = can('inventory.waste')
  const canTransfer = can('inventory.transfer')
  const canConfigureProductInventory = canSetup && canCatalogManage

  async function refresh() {
    if (!currentBranchId || !canView) return
    setLoading(true)
    setError(null)
    try {
      const core = await Promise.all([
        listWarehouses(currentBranchId),
        listInventoryItems(currentBranchId),
        listInventoryBalances(currentBranchId),
      ])
      setWarehouses(core[0])
      setItems(core[1])
      setBalances(core[2])

      if (canConfigureProductInventory) {
        const [nextProducts, nextComponents] = await Promise.all([
          listInventoryProducts(currentBranchId),
          listProductComponents(currentBranchId),
        ])
        setProducts(nextProducts)
        setComponents(nextComponents)
      } else {
        setProducts([])
        setComponents([])
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل المخزون')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [currentBranchId, canView, canConfigureProductInventory])

  const balanceByItem = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of balances) map.set(row.inventory_item_id, (map.get(row.inventory_item_id) ?? 0) + row.quantity)
    return map
  }, [balances])

  const componentsByProduct = useMemo(() => {
    const map = new Map<string, ProductComponent[]>()
    for (const component of components) {
      const rows = map.get(component.product_id) ?? []
      rows.push(component)
      map.set(component.product_id, rows)
    }
    return map
  }, [components])

  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])

  if (!currentBranchId || !canView) return null
  const branchId = currentBranchId

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
      await createWarehouse({ branchId, code: String(data.get('code') ?? ''), nameAr: String(data.get('nameAr') ?? '') })
      form.reset()
    })
  }

  async function handleItemSubmit(form: HTMLFormElement) {
    const data = new FormData(form)
    await runAction(async () => {
      await createInventoryItem({
        branchId,
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
        branchId,
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
        branchId,
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

  async function handleDirectMappingSubmit(form: HTMLFormElement) {
    const data = new FormData(form)
    const inventoryItemId = String(data.get('inventoryItemId') ?? '') || null
    await runAction(async () => {
      await setProductInventoryItem(String(data.get('productId') ?? ''), inventoryItemId)
      form.reset()
    })
  }

  async function handleComponentSubmit(form: HTMLFormElement) {
    const data = new FormData(form)
    await runAction(async () => {
      await addProductComponent({
        branchId,
        productId: String(data.get('productId') ?? ''),
        inventoryItemId: String(data.get('inventoryItemId') ?? ''),
        quantity: Number(data.get('quantity') ?? 0),
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

      {canConfigureProductInventory && products.length > 0 && items.length > 0 ? (
        <div className="inventory-mapping-section">
          <h3>ربط المنتجات بالمخزون</h3>
          <p>اختر طريقة واحدة لكل منتج: مخزون مباشر للمنتج الجاهز، أو BOM للمكونات. النظام يمنع الجمع بينهما.</p>
          <div className="inventory-setup-grid">
            <form className="inline-form" onSubmit={(event) => { event.preventDefault(); void handleDirectMappingSubmit(event.currentTarget) }}>
              <h4>منتج جاهز ↔ عنصر مخزون</h4>
              <select name="productId" required defaultValue=""><option value="" disabled>المنتج</option>{products.filter((product) => product.is_active).map((product) => <option key={product.id} value={product.id}>{product.name_ar}</option>)}</select>
              <select name="inventoryItemId" defaultValue=""><option value="">إلغاء الربط المباشر</option>{renderItemOptions()}</select>
              <button type="submit">حفظ الربط</button>
            </form>

            <form className="inline-form" onSubmit={(event) => { event.preventDefault(); void handleComponentSubmit(event.currentTarget) }}>
              <h4>إضافة مكوّن BOM</h4>
              <select name="productId" required defaultValue=""><option value="" disabled>المنتج</option>{products.filter((product) => product.is_active).map((product) => <option key={product.id} value={product.id}>{product.name_ar}</option>)}</select>
              <select name="inventoryItemId" required defaultValue=""><option value="" disabled>عنصر المخزون</option>{renderItemOptions()}</select>
              <input name="quantity" type="number" min="0.000001" step="0.000001" required placeholder="كمية المكوّن لكل وحدة بيع" />
              <button type="submit">إضافة المكوّن</button>
            </form>
          </div>

          <div className="mapping-list">
            {products.map((product) => {
              const productComponents = componentsByProduct.get(product.id) ?? []
              return (
                <div key={product.id} className="mapping-row">
                  <strong>{product.name_ar}</strong>
                  <span>{product.inventory_item_id ? `مباشر: ${itemById.get(product.inventory_item_id)?.name_ar ?? product.inventory_item_id}` : productComponents.length ? `BOM: ${productComponents.length} مكوّن` : 'غير مربوط بالمخزون'}</span>
                  {productComponents.length ? (
                    <div className="component-chips">
                      {productComponents.map((component) => (
                        <button key={component.inventory_item_id} type="button" onClick={() => void runAction(() => removeProductComponent({ branchId, productId: product.id, inventoryItemId: component.inventory_item_id }))}>
                          {itemById.get(component.inventory_item_id)?.name_ar ?? component.inventory_item_id} × {component.quantity} — حذف
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
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
          <thead><tr><th>الكود</th><th>العنصر</th><th>الوحدة</th><th>إجمالي الرصيد</th><th>الحد الأدنى</th></tr></thead>
          <tbody>
            {items.map((item) => <tr key={item.id}><td>{item.code}</td><td>{item.name_ar}</td><td>{item.base_unit}</td><td>{balanceByItem.get(item.id) ?? 0}</td><td>{item.minimum_level}</td></tr>)}
            {!items.length && !loading ? <tr><td colSpan={5}>لا توجد عناصر مخزون بعد.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}
