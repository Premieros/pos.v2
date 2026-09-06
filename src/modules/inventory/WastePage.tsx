import { useEffect, useMemo, useState } from 'react'
import { useBranch } from '../branches/useBranch'
import { usePermissions } from '../permissions/usePermissions'
import { listInventoryItems, listWarehouses, type InventoryItem, type Warehouse } from './inventory.service'
import { addWasteDocumentLine, createWasteDocument, listWasteDocumentLines, listWasteDocuments, postWasteDocument, type WasteDocument, type WasteDocumentLine } from './waste.service'
import './waste.css'

const statusLabel: Record<WasteDocument['status'], string> = {
  draft: 'مسودة',
  posted: 'معتمد',
  cancelled: 'ملغي',
}

export function WastePage() {
  const { currentBranchId } = useBranch()
  const { can } = usePermissions()
  const canWaste = can('inventory.waste')
  const [documents, setDocuments] = useState<WasteDocument[]>([])
  const [lines, setLines] = useState<WasteDocumentLine[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [items, setItems] = useState<InventoryItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const branchId = currentBranchId
  const selected = useMemo(() => documents.find((doc) => doc.id === selectedId) ?? null, [documents, selectedId])
  const warehouseById = useMemo(() => new Map(warehouses.map((w) => [w.id, w])), [warehouses])
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])

  async function refreshDocuments() {
    if (!branchId || !canWaste) return
    const next = await listWasteDocuments(branchId)
    setDocuments(next)
    setSelectedId((current) => current && next.some((doc) => doc.id === current) ? current : next[0]?.id ?? null)
  }

  async function refreshReferences() {
    if (!branchId || !canWaste) return
    const [nextWarehouses, nextItems] = await Promise.all([listWarehouses(branchId), listInventoryItems(branchId)])
    setWarehouses(nextWarehouses.filter((row) => row.is_active))
    setItems(nextItems.filter((row) => row.is_active))
  }

  async function refreshAll() {
    if (!branchId || !canWaste) return
    setLoading(true)
    setError(null)
    try {
      await Promise.all([refreshDocuments(), refreshReferences()])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل مركز الهالك')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refreshAll() }, [branchId, canWaste])

  useEffect(() => {
    if (!selectedId) { setLines([]); return }
    void (async () => {
      try { setLines(await listWasteDocumentLines(selectedId)) }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر تحميل بنود الهالك') }
    })()
  }, [selectedId])

  if (!branchId || !canWaste) return null
  const activeBranchId = branchId

  async function handleCreate(form: HTMLFormElement) {
    const data = new FormData(form)
    const warehouseId = String(data.get('warehouseId') ?? '')
    const reason = String(data.get('reason') ?? '').trim()
    if (!warehouseId || !reason) return
    setError(null)
    try {
      const id = await createWasteDocument({ branchId: activeBranchId, warehouseId, reason, note: String(data.get('note') ?? '') })
      form.reset()
      await refreshDocuments()
      setSelectedId(id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر إنشاء مستند الهالك')
    }
  }

  async function handleAddLine(form: HTMLFormElement) {
    if (!selected || selected.status !== 'draft') return
    const data = new FormData(form)
    const inventoryItemId = String(data.get('inventoryItemId') ?? '')
    const quantity = Number(data.get('quantity'))
    if (!inventoryItemId || !Number.isFinite(quantity) || quantity <= 0) return
    setError(null)
    try {
      await addWasteDocumentLine({ documentId: selected.id, inventoryItemId, quantity, note: String(data.get('lineNote') ?? '') })
      form.reset()
      setLines(await listWasteDocumentLines(selected.id))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر إضافة بند الهالك')
    }
  }

  async function handlePost() {
    if (!selected || selected.status !== 'draft') return
    if (!lines.length) { setError('أضف بندًا واحدًا على الأقل قبل الاعتماد.'); return }
    if (!window.confirm('اعتماد مستند الهالك وخصم الكميات من المخزون؟')) return
    setError(null)
    try {
      await postWasteDocument(selected.id)
      await refreshDocuments()
      setLines(await listWasteDocumentLines(selected.id))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر اعتماد مستند الهالك')
    }
  }

  return (
    <section className="workspace-card waste-workspace" aria-labelledby="waste-title">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">Inventory Control</p>
          <h2 id="waste-title">مركز الهالك</h2>
          <p>مستند رسمي مرتبط بمخزن وصنف حقيقيين. الاعتماد فقط هو الذي يخصم من دفتر حركة المخزون.</p>
        </div>
        <span>{documents.length} مستند</span>
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {loading ? <p>جارٍ تحميل مستندات الهالك…</p> : null}

      <form className="waste-create-form" onSubmit={(event) => { event.preventDefault(); void handleCreate(event.currentTarget) }}>
        <select name="warehouseId" required defaultValue="">
          <option value="" disabled>اختر المخزن</option>
          {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name_ar} — {warehouse.code}</option>)}
        </select>
        <input name="reason" required placeholder="سبب الهالك" />
        <input name="note" placeholder="ملاحظة اختيارية" />
        <button type="submit" disabled={!warehouses.length}>إنشاء مستند هالك</button>
      </form>

      {!warehouses.length ? <p className="muted-text">لا يوجد مخزن نشط. أنشئ مخزنًا أولًا.</p> : null}
      {!items.length ? <p className="muted-text">لا توجد وحدات مخزون نشطة. أنشئ وحدة مخزون أولًا.</p> : null}

      <div className="waste-layout">
        <aside className="waste-doc-list" aria-label="مستندات الهالك">
          {documents.map((doc) => (
            <button key={doc.id} type="button" className={doc.id === selectedId ? 'waste-doc-card is-active' : 'waste-doc-card'} onClick={() => setSelectedId(doc.id)}>
              <strong>{doc.reason}</strong>
              <span>{warehouseById.get(doc.warehouse_id)?.name_ar ?? 'مخزن غير متاح'}</span>
              <span>{statusLabel[doc.status]}</span>
              <small>{new Date(doc.created_at).toLocaleString('ar-EG')}</small>
            </button>
          ))}
          {!loading && !documents.length ? <p className="muted-text">لا توجد مستندات هالك بعد.</p> : null}
        </aside>

        <div className="waste-detail">
          {selected ? (
            <>
              <div className="waste-summary">
                <div><span>الحالة</span><strong>{statusLabel[selected.status]}</strong></div>
                <div><span>المخزن</span><strong>{warehouseById.get(selected.warehouse_id)?.name_ar ?? '—'}</strong></div>
                <div><span>السبب</span><strong>{selected.reason}</strong></div>
                <div><span>الاعتماد</span><strong>{selected.posted_at ? new Date(selected.posted_at).toLocaleString('ar-EG') : '—'}</strong></div>
              </div>

              {selected.status === 'draft' ? (
                <form className="waste-line-form" onSubmit={(event) => { event.preventDefault(); void handleAddLine(event.currentTarget) }}>
                  <select name="inventoryItemId" required defaultValue="">
                    <option value="" disabled>اختر الصنف المخزني</option>
                    {items.map((item) => <option key={item.id} value={item.id}>{item.name_ar} — {item.base_unit}</option>)}
                  </select>
                  <input name="quantity" type="number" min="0.0001" step="0.0001" required placeholder="الكمية" />
                  <input name="lineNote" placeholder="ملاحظة البند" />
                  <button type="submit" disabled={!items.length}>إضافة بند</button>
                </form>
              ) : null}

              <div className="waste-lines">
                <div className="waste-line waste-line-head"><span>الصنف</span><span>الكمية</span><span>الوحدة</span><span>مرجع الحركة</span></div>
                {lines.map((line) => {
                  const item = itemById.get(line.inventory_item_id)
                  return <div className="waste-line" key={line.id}>
                    <strong>{item?.name_ar ?? line.inventory_item_id}</strong>
                    <span>{line.quantity}</span>
                    <span>{item?.base_unit ?? '—'}</span>
                    <span>{line.stock_movement_id ? 'تم الخصم' : 'لم يعتمد'}</span>
                  </div>
                })}
                {!lines.length ? <p className="muted-text">لا توجد بنود في هذا المستند.</p> : null}
              </div>

              {selected.status === 'draft' ? <button className="waste-post-button" type="button" onClick={() => void handlePost()} disabled={!lines.length}>اعتماد وخصم الهالك</button> : null}
            </>
          ) : <p className="muted-text">اختر مستند هالك أو أنشئ مستندًا جديدًا.</p>}
        </div>
      </div>
    </section>
  )
}
