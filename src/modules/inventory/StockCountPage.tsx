import { useEffect, useMemo, useState } from 'react'
import { useBranch } from '../branches/useBranch'
import { usePermissions } from '../permissions/usePermissions'
import { listInventoryItems, listWarehouses, type InventoryItem, type Warehouse } from './inventory.service'
import { createStockCountSession, listStockCountLines, listStockCountSessions, setStockCountLine, submitStockCountSession, type StockCountLine, type StockCountSession } from './count.service'
import './count.css'

const statusLabel: Record<StockCountSession['status'], string> = {
  draft: 'مسودة',
  pending_approval: 'بانتظار الموافقة',
  posted: 'معتمد',
  rejected: 'مرفوض',
  cancelled: 'ملغي',
}

export function StockCountPage() {
  const { currentBranchId } = useBranch()
  const { can } = usePermissions()
  const canCount = can('inventory.count')
  const [sessions, setSessions] = useState<StockCountSession[]>([])
  const [lines, setLines] = useState<StockCountLine[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [items, setItems] = useState<InventoryItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const branchId = currentBranchId
  const selected = useMemo(() => sessions.find((session) => session.id === selectedId) ?? null, [sessions, selectedId])
  const warehouseById = useMemo(() => new Map(warehouses.map((row) => [row.id, row])), [warehouses])
  const itemById = useMemo(() => new Map(items.map((row) => [row.id, row])), [items])

  async function refreshSessions() {
    if (!branchId || !canCount) return
    const next = await listStockCountSessions(branchId)
    setSessions(next)
    setSelectedId((current) => current && next.some((session) => session.id === current) ? current : next[0]?.id ?? null)
  }

  async function refreshReferences() {
    if (!branchId || !canCount) return
    const [nextWarehouses, nextItems] = await Promise.all([listWarehouses(branchId), listInventoryItems(branchId)])
    setWarehouses(nextWarehouses.filter((row) => row.is_active))
    setItems(nextItems.filter((row) => row.is_active))
  }

  async function refreshAll() {
    if (!branchId || !canCount) return
    setLoading(true)
    setError(null)
    try { await Promise.all([refreshSessions(), refreshReferences()]) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر تحميل جلسات الجرد') }
    finally { setLoading(false) }
  }

  useEffect(() => { void refreshAll() }, [branchId, canCount])

  useEffect(() => {
    if (!selectedId) { setLines([]); return }
    void (async () => {
      try { setLines(await listStockCountLines(selectedId)) }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر تحميل بنود الجرد') }
    })()
  }, [selectedId])

  if (!branchId || !canCount) return null
  const activeBranchId = branchId

  async function handleCreate(form: HTMLFormElement) {
    const data = new FormData(form)
    const warehouseId = String(data.get('warehouseId') ?? '')
    if (!warehouseId) return
    setError(null)
    try {
      const id = await createStockCountSession({ branchId: activeBranchId, warehouseId, note: String(data.get('note') ?? '') })
      form.reset()
      await refreshSessions()
      setSelectedId(id)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر إنشاء جلسة الجرد') }
  }

  async function handleSetLine(form: HTMLFormElement) {
    if (!selected || selected.status !== 'draft') return
    const data = new FormData(form)
    const inventoryItemId = String(data.get('inventoryItemId') ?? '')
    const countedQuantity = Number(data.get('countedQuantity'))
    if (!inventoryItemId || !Number.isFinite(countedQuantity) || countedQuantity < 0) return
    setError(null)
    try {
      await setStockCountLine({ sessionId: selected.id, inventoryItemId, countedQuantity })
      form.reset()
      setLines(await listStockCountLines(selected.id))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر تسجيل كمية الجرد') }
  }

  async function handleSubmit() {
    if (!selected || selected.status !== 'draft') return
    if (!lines.length) { setError('أضف بندًا واحدًا على الأقل قبل الإرسال للموافقة.'); return }
    if (!window.confirm('إرسال جلسة الجرد للموافقة؟ لن يتم تعديل المخزون في هذه الخطوة.')) return
    setError(null)
    try {
      await submitStockCountSession(selected.id)
      await refreshSessions()
      setLines(await listStockCountLines(selected.id))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر إرسال الجرد للموافقة') }
  }

  return (
    <section className="workspace-card count-workspace" aria-labelledby="count-title">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">Inventory Control</p>
          <h2 id="count-title">جلسات الجرد</h2>
          <p>يسجل النظام رصيد النظام وقت العد والكمية الفعلية ويحسب الفرق آليًا. لا يُعدل المخزون قبل الموافقة.</p>
        </div>
        <span>{sessions.length} جلسة</span>
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {loading ? <p>جارٍ تحميل جلسات الجرد…</p> : null}

      <form className="count-create-form" onSubmit={(event) => { event.preventDefault(); void handleCreate(event.currentTarget) }}>
        <select name="warehouseId" required defaultValue="">
          <option value="" disabled>اختر المخزن</option>
          {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name_ar} — {warehouse.code}</option>)}
        </select>
        <input name="note" placeholder="ملاحظة الجرد" />
        <button type="submit" disabled={!warehouses.length}>بدء جلسة جرد</button>
      </form>

      {!warehouses.length ? <p className="muted-text">لا يوجد مخزن نشط. أنشئ مخزنًا أولًا.</p> : null}
      {!items.length ? <p className="muted-text">لا توجد وحدات مخزون نشطة للجرد.</p> : null}

      <div className="count-layout">
        <aside className="count-session-list" aria-label="جلسات الجرد">
          {sessions.map((session) => (
            <button key={session.id} type="button" className={session.id === selectedId ? 'count-session-card is-active' : 'count-session-card'} onClick={() => setSelectedId(session.id)}>
              <strong>{warehouseById.get(session.warehouse_id)?.name_ar ?? 'مخزن غير متاح'}</strong>
              <span>{statusLabel[session.status]}</span>
              <small>{new Date(session.created_at).toLocaleString('ar-EG')}</small>
            </button>
          ))}
          {!loading && !sessions.length ? <p className="muted-text">لا توجد جلسات جرد بعد.</p> : null}
        </aside>

        <div className="count-detail">
          {selected ? (
            <>
              <div className="count-summary">
                <div><span>الحالة</span><strong>{statusLabel[selected.status]}</strong></div>
                <div><span>المخزن</span><strong>{warehouseById.get(selected.warehouse_id)?.name_ar ?? '—'}</strong></div>
                <div><span>البنود</span><strong>{lines.length}</strong></div>
                <div><span>أرسل للموافقة</span><strong>{selected.submitted_at ? new Date(selected.submitted_at).toLocaleString('ar-EG') : '—'}</strong></div>
              </div>

              {selected.status === 'draft' ? (
                <form className="count-line-form" onSubmit={(event) => { event.preventDefault(); void handleSetLine(event.currentTarget) }}>
                  <select name="inventoryItemId" required defaultValue="">
                    <option value="" disabled>اختر الصنف المخزني</option>
                    {items.map((item) => <option key={item.id} value={item.id}>{item.name_ar} — {item.base_unit}</option>)}
                  </select>
                  <input name="countedQuantity" type="number" min="0" step="0.0001" required placeholder="الكمية الفعلية" />
                  <button type="submit" disabled={!items.length}>تسجيل / تحديث</button>
                </form>
              ) : null}

              <div className="count-lines">
                <div className="count-line count-line-head"><span>الصنف</span><span>رصيد النظام</span><span>الفعلي</span><span>الفرق</span></div>
                {lines.map((line) => {
                  const item = itemById.get(line.inventory_item_id)
                  return <div className="count-line" key={line.id}>
                    <strong>{item?.name_ar ?? line.inventory_item_id}</strong>
                    <span>{line.system_quantity}</span>
                    <span>{line.counted_quantity}</span>
                    <strong>{line.variance_quantity > 0 ? `+${line.variance_quantity}` : line.variance_quantity}</strong>
                  </div>
                })}
                {!lines.length ? <p className="muted-text">لم يتم تسجيل أي صنف بعد.</p> : null}
              </div>

              {selected.status === 'draft' ? <button className="count-submit-button" type="button" onClick={() => void handleSubmit()} disabled={!lines.length}>إرسال للموافقة</button> : null}
              {selected.status === 'pending_approval' ? <p className="muted-text">هذه الجلسة مجمدة وتنتظر Approval Center. لم يُنشأ أي Stock Movement بعد.</p> : null}
            </>
          ) : <p className="muted-text">اختر جلسة جرد أو ابدأ جلسة جديدة.</p>}
        </div>
      </div>
    </section>
  )
}
