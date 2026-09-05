import { useEffect, useMemo, useState } from 'react'
import { useBranch } from '../branches/useBranch'
import { listInventoryItems, listWarehouses, type InventoryItem, type Warehouse } from '../inventory/inventory.service'
import type { StockCountLine, StockCountSession } from '../inventory/count.service'
import { usePermissions } from '../permissions/usePermissions'
import { getApprovalStockCount, listApprovalRequests, reviewStockCountApproval, type ApprovalRequest } from './approval.service'
import './approvals.css'

const statusLabel: Record<ApprovalRequest['status'], string> = { pending: 'بانتظار المراجعة', approved: 'مقبول', rejected: 'مرفوض' }

export function ApprovalCenterPage() {
  const { currentBranchId } = useBranch()
  const { can } = usePermissions()
  const canView = can('approvals.view') || can('approvals.review')
  const canReview = can('approvals.review')
  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [session, setSession] = useState<StockCountSession | null>(null)
  const [lines, setLines] = useState<StockCountLine[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const branchId = currentBranchId
  const selected = useMemo(() => requests.find((request) => request.id === selectedId) ?? null, [requests, selectedId])
  const warehouseById = useMemo(() => new Map(warehouses.map((row) => [row.id, row])), [warehouses])
  const itemById = useMemo(() => new Map(items.map((row) => [row.id, row])), [items])

  async function refreshRequests() {
    if (!branchId || !canView) return
    const next = await listApprovalRequests(branchId)
    setRequests(next)
    setSelectedId((current) => current && next.some((request) => request.id === current) ? current : next[0]?.id ?? null)
  }

  async function refreshReferences() {
    if (!branchId || !canView) return
    const [nextWarehouses, nextItems] = await Promise.all([listWarehouses(branchId), listInventoryItems(branchId)])
    setWarehouses(nextWarehouses)
    setItems(nextItems)
  }

  async function refreshAll() {
    if (!branchId || !canView) return
    setLoading(true)
    setError(null)
    try { await Promise.all([refreshRequests(), refreshReferences()]) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر تحميل مركز الموافقات') }
    finally { setLoading(false) }
  }

  useEffect(() => { void refreshAll() }, [branchId, canView])

  useEffect(() => {
    if (!selected) { setSession(null); setLines([]); return }
    void (async () => {
      try {
        const detail = await getApprovalStockCount(selected.stock_count_session_id)
        setSession(detail.session)
        setLines(detail.lines)
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر تحميل تفاصيل طلب الموافقة') }
    })()
  }, [selected?.id])

  if (!branchId || !canView) return null

  async function handleReview(decision: 'approve' | 'reject') {
    if (!selected || selected.status !== 'pending' || !canReview) return
    const promptText = decision === 'approve' ? 'ملاحظة الموافقة (اختيارية)' : 'سبب الرفض (إلزامي)'
    const reason = window.prompt(promptText, '')
    if (reason === null) return
    if (decision === 'reject' && !reason.trim()) { setError('سبب الرفض إلزامي.'); return }
    const confirmText = decision === 'approve'
      ? 'اعتماد فروق الجرد وإنشاء حركات count_adjustment في المخزون؟'
      : 'رفض طلب الجرد؟ لن يتم تعديل المخزون.'
    if (!window.confirm(confirmText)) return
    setError(null)
    try {
      await reviewStockCountApproval({ requestId: selected.id, decision, reason })
      await refreshRequests()
      const detail = await getApprovalStockCount(selected.stock_count_session_id)
      setSession(detail.session)
      setLines(detail.lines)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر مراجعة الطلب') }
  }

  return (
    <section className="workspace-card approvals-workspace" aria-labelledby="approvals-title">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">Control Center</p>
          <h2 id="approvals-title">مركز الموافقات</h2>
          <p>مراجعة فروق الجرد قبل تأثيرها على المخزون. الموافقة الذاتية ممنوعة افتراضيًا.</p>
        </div>
        <span>{requests.filter((request) => request.status === 'pending').length} معلق</span>
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {loading ? <p>جارٍ تحميل الموافقات…</p> : null}

      <div className="approval-layout">
        <aside className="approval-list" aria-label="طلبات الموافقة">
          {requests.map((request) => (
            <button key={request.id} type="button" className={request.id === selectedId ? 'approval-card is-active' : 'approval-card'} onClick={() => setSelectedId(request.id)}>
              <strong>فرق جرد مخزون</strong>
              <span>{statusLabel[request.status]}</span>
              <small>{new Date(request.requested_at).toLocaleString('ar-EG')}</small>
            </button>
          ))}
          {!loading && !requests.length ? <p className="muted-text">لا توجد طلبات موافقة.</p> : null}
        </aside>

        <div className="approval-detail">
          {selected && session ? (
            <>
              <div className="approval-summary">
                <div><span>الحالة</span><strong>{statusLabel[selected.status]}</strong></div>
                <div><span>المخزن</span><strong>{warehouseById.get(session.warehouse_id)?.name_ar ?? '—'}</strong></div>
                <div><span>طالب الموافقة</span><strong>{selected.requested_by.slice(0, 8)}…</strong></div>
                <div><span>وقت الطلب</span><strong>{new Date(selected.requested_at).toLocaleString('ar-EG')}</strong></div>
              </div>

              <div className="approval-lines">
                <div className="approval-line approval-line-head"><span>الصنف</span><span>رصيد النظام</span><span>الجرد الفعلي</span><span>الفرق</span></div>
                {lines.map((line) => (
                  <div className="approval-line" key={line.id}>
                    <strong>{itemById.get(line.inventory_item_id)?.name_ar ?? line.inventory_item_id}</strong>
                    <span>{line.system_quantity}</span>
                    <span>{line.counted_quantity}</span>
                    <strong>{line.variance_quantity > 0 ? `+${line.variance_quantity}` : line.variance_quantity}</strong>
                  </div>
                ))}
              </div>

              {selected.status === 'pending' && canReview ? (
                <div className="approval-actions">
                  <button type="button" onClick={() => void handleReview('approve')}>موافقة وتطبيق الفرق</button>
                  <button type="button" onClick={() => void handleReview('reject')}>رفض</button>
                </div>
              ) : null}

              {selected.reviewed_at ? <p className="muted-text">تمت المراجعة: {new Date(selected.reviewed_at).toLocaleString('ar-EG')}{selected.review_reason ? ` — ${selected.review_reason}` : ''}</p> : null}
            </>
          ) : <p className="muted-text">اختر طلب موافقة لعرض التفاصيل.</p>}
        </div>
      </div>
    </section>
  )
}
