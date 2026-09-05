import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { useBranch } from '../branches/useBranch'
import { usePermissions } from '../permissions/usePermissions'
import {
  listPendingShiftCloses,
  queueShiftClose,
  syncPendingShiftClose,
  syncPendingShiftCloses,
  type PendingShiftClose,
} from './offlineShiftClose'
import './offline-shift.css'
import { closeShift, listShifts, openShift, recordCashMovement, type Shift } from './shift.service'

function isLikelyNetworkError(cause: unknown) {
  if (!navigator.onLine) return true
  const message = cause instanceof Error ? cause.message : String(cause ?? '')
  return /failed to fetch|networkerror|network request failed|fetch failed|load failed/i.test(message)
}

export function ShiftsPage() {
  const { user } = useAuth()
  const { currentBranchId } = useBranch()
  const { can } = usePermissions()
  const [shifts, setShifts] = useState<Shift[]>([])
  const [pending, setPending] = useState<PendingShiftClose[]>([])
  const [printIntent, setPrintIntent] = useState<PendingShiftClose | null>(null)
  const [online, setOnline] = useState(() => navigator.onLine)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const canView = can('shifts.view') || can('shifts.manage') || can('shifts.open') || can('shifts.close') || can('shifts.cash.move')
  const canOpen = can('shifts.open') || can('shifts.manage')
  const canClose = can('shifts.close') || can('shifts.manage')
  const canMoveCash = can('shifts.cash.move') || can('shifts.manage')

  function refreshPending() {
    if (!user?.id || !currentBranchId) { setPending([]); return }
    setPending(listPendingShiftCloses(user.id, currentBranchId))
  }

  async function refresh() {
    if (!currentBranchId || !canView) return
    setLoading(true)
    setError(null)
    try { setShifts(await listShifts(currentBranchId)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر تحميل الورديات') }
    finally { setLoading(false) }
  }

  async function syncAllPending() {
    if (!user?.id || !currentBranchId || !navigator.onLine || syncing) return
    setSyncing(true)
    setError(null)
    try {
      const result = await syncPendingShiftCloses(user.id, currentBranchId)
      refreshPending()
      await refresh()
      if (result.synced > 0) setNotice(`تم تأكيد ${result.synced} طلب إغلاق معلّق من الخادم.`)
      if (result.failed > 0) setError(`تعذر تأكيد ${result.failed} طلب إغلاق معلّق. راجع التفاصيل وأعد المحاولة.`)
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => { void refresh(); refreshPending() }, [currentBranchId, canView, user?.id])

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true)
      void syncAllPending()
    }
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    if (navigator.onLine) void syncAllPending()
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [user?.id, currentBranchId])

  const openCurrent = useMemo(() => shifts.find((shift) => shift.status === 'open') ?? null, [shifts])
  const pendingShiftIds = useMemo(() => new Set(pending.map((item) => item.shiftId)), [pending])

  if (!currentBranchId || !canView) return null
  const branchId = currentBranchId

  async function run(action: () => Promise<void>) {
    setError(null)
    setNotice(null)
    try { await action(); await refresh() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر تنفيذ العملية') }
  }

  function printPendingIntent(item: PendingShiftClose) {
    setPrintIntent(item)
    window.setTimeout(() => window.print(), 80)
  }

  async function handleClose(form: HTMLFormElement, shift: Shift) {
    if (!user?.id) return
    const data = new FormData(form)
    const actualCash = Number(data.get('actualCash') ?? 0)
    const note = String(data.get('note') ?? '')
    const idempotencyKey = crypto.randomUUID()
    const intentBase = { idempotencyKey, userId: user.id, branchId, shiftId: shift.id, actualCash, note }

    setError(null)
    setNotice(null)

    if (!navigator.onLine) {
      const queued = queueShiftClose(intentBase)
      refreshPending()
      form.reset()
      setNotice('تم حفظ طلب إغلاق الوردية محليًا. الوردية ليست مغلقة نهائيًا حتى يؤكد الخادم الطلب.')
      printPendingIntent(queued)
      return
    }

    try {
      await closeShift({ shiftId: shift.id, branchId, actualCash, note, idempotencyKey })
      form.reset()
      await refresh()
      setNotice('تم إغلاق الوردية وتأكيدها من الخادم.')
    } catch (cause) {
      if (isLikelyNetworkError(cause)) {
        const queued = queueShiftClose(intentBase)
        refreshPending()
        form.reset()
        setNotice('انقطع الاتصال أثناء الإغلاق. تم حفظ نفس الطلب محليًا لإعادة الإرسال بالمفتاح نفسه؛ لا يُعتبر الإغلاق نهائيًا بعد.')
        printPendingIntent(queued)
      } else {
        setError(cause instanceof Error ? cause.message : 'تعذر إغلاق الوردية')
      }
    }
  }

  async function retryPending(item: PendingShiftClose) {
    if (!navigator.onLine) return
    setSyncing(true)
    setError(null)
    try {
      await syncPendingShiftClose(item)
      refreshPending()
      await refresh()
      setNotice('أكد الخادم طلب إغلاق الوردية المعلّق.')
    } catch (cause) {
      refreshPending()
      setError(cause instanceof Error ? cause.message : 'تعذر إعادة مزامنة إغلاق الوردية')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <section className="workspace-card" aria-labelledby="shifts-title">
      <div className="workspace-heading">
        <div><p className="eyebrow">SHIFTS</p><h2 id="shifts-title">الورديات والدرج</h2><p>فتح وإغلاق الوردية وحركات النقدية بعقود خادمية مستقلة. عند فقد الاتصال، إغلاق الوردية يُحفظ كطلب معلّق ولا يُعتبر نهائيًا قبل تأكيد الخادم.</p></div>
        <span>{online ? 'متصل' : 'غير متصل'}</span>
      </div>
      {error ? <p className="error-text">{error}</p> : null}
      {notice ? <p className="success-text">{notice}</p> : null}
      {loading ? <p>جارٍ تحميل الورديات…</p> : null}

      {pending.length ? (
        <section className="offline-close-status" aria-label="طلبات إغلاق ورديات معلقة">
          <div><strong>طلبات إغلاق بانتظار تأكيد الخادم: {pending.length}</strong><p>هذه الطلبات محفوظة على هذا الجهاز لهذا المستخدم والفرع، ولم تُعتبر إغلاقًا نهائيًا بعد.</p></div>
          <div className="offline-close-list">
            {pending.map((item) => (
              <article className="offline-close-item" key={item.idempotencyKey}>
                <div>
                  <strong>وردية {item.shiftId.slice(0, 8)}… · نقد فعلي {item.actualCash.toFixed(2)}</strong>
                  <small>حُفظت: {new Date(item.createdAt).toLocaleString('ar-EG')}</small>
                  {item.lastError ? <small className="error-text">آخر خطأ: {item.lastError}</small> : null}
                </div>
                <div className="offline-close-actions">
                  <button type="button" disabled={!online || syncing} onClick={() => void retryPending(item)}>إعادة المزامنة</button>
                  <button type="button" onClick={() => printPendingIntent(item)}>طباعة إثبات الانتظار</button>
                </div>
              </article>
            ))}
          </div>
          {online ? <button type="button" disabled={syncing} onClick={() => void syncAllPending()}>{syncing ? 'جارٍ المزامنة…' : 'مزامنة الكل'}</button> : null}
        </section>
      ) : null}

      {!openCurrent && canOpen ? (
        <form className="inline-form" onSubmit={(event) => { event.preventDefault(); const form=event.currentTarget; const data=new FormData(form); void run(async()=>{ await openShift(branchId, Number(data.get('openingBalance') ?? 0)); form.reset() }) }}>
          <h3>فتح وردية</h3>
          <input name="openingBalance" type="number" min="0" step="0.01" required placeholder="رصيد بداية الدرج" />
          <button type="submit" disabled={!online}>فتح الوردية</button>
          {!online ? <small>فتح وردية جديدة يحتاج تأكيد الخادم ولا يتم وضعه في صف Offline.</small> : null}
        </form>
      ) : null}

      {openCurrent ? (
        <div className="form-grid">
          {canMoveCash ? (
            <form className="inline-form" onSubmit={(event)=>{event.preventDefault(); const form=event.currentTarget; const data=new FormData(form); void run(async()=>{ await recordCashMovement({ shiftId: openCurrent.id, branchId, movementType: String(data.get('movementType')) as 'cash_in'|'cash_out', amount:Number(data.get('amount')??0), reason:String(data.get('reason')??'') }); form.reset() })}}>
              <h3>حركة درج</h3>
              <select name="movementType" defaultValue="cash_in"><option value="cash_in">إضافة نقدية</option><option value="cash_out">سحب نقدية</option></select>
              <input name="amount" type="number" min="0.01" step="0.01" required placeholder="القيمة" />
              <input name="reason" required placeholder="السبب" />
              <button type="submit" disabled={!online}>تسجيل الحركة</button>
              {!online ? <small>حركة الدرج المالية تتطلب الخادم ولا تُسجل Offline.</small> : null}
            </form>
          ) : null}

          {canClose ? (
            <form className="inline-form" onSubmit={(event)=>{event.preventDefault(); void handleClose(event.currentTarget, openCurrent)}}>
              <h3>إغلاق الوردية</h3>
              <input name="actualCash" type="number" min="0" step="0.01" required placeholder="النقدية الفعلية" />
              <input name="note" placeholder="ملاحظة الإغلاق" />
              <button type="submit" disabled={pendingShiftIds.has(openCurrent.id)}>{online ? 'إغلاق الوردية' : 'حفظ طلب الإغلاق Offline'}</button>
              {pendingShiftIds.has(openCurrent.id) ? <small>يوجد بالفعل طلب إغلاق معلّق لهذه الوردية؛ أعد مزامنته بدل إنشاء طلب ثانٍ.</small> : null}
            </form>
          ) : null}
        </div>
      ) : null}

      <div className="table-wrap">
        <table>
          <thead><tr><th>الحالة</th><th>بداية الدرج</th><th>المتوقع</th><th>الفعلي</th><th>الفرق</th><th>فتح</th><th>إغلاق</th></tr></thead>
          <tbody>
            {shifts.map((shift)=><tr key={shift.id}><td>{shift.status === 'open' ? (pendingShiftIds.has(shift.id) ? 'مفتوحة — طلب إغلاق معلّق' : 'مفتوحة') : 'مغلقة'}</td><td>{shift.opening_balance}</td><td>{shift.expected_cash ?? '—'}</td><td>{shift.actual_cash ?? '—'}</td><td>{shift.cash_difference ?? '—'}</td><td>{new Date(shift.opened_at).toLocaleString('ar-EG')}</td><td>{shift.closed_at ? new Date(shift.closed_at).toLocaleString('ar-EG') : '—'}</td></tr>)}
            {!shifts.length && !loading ? <tr><td colSpan={7}>لا توجد ورديات بعد.</td></tr> : null}
          </tbody>
        </table>
      </div>

      {printIntent ? <article className="offline-close-print-root active" dir="rtl">
        <div className="offline-close-paper">
          <h2>POS.V2</h2>
          <h3>إثبات استلام طلب إغلاق وردية</h3>
          <div className="offline-warning">بانتظار تأكيد الخادم — ليست وردية مغلقة نهائيًا</div>
          <p>الوردية: {printIntent.shiftId}</p>
          <p>النقدية الفعلية: {printIntent.actualCash.toFixed(2)}</p>
          <p>وقت الحفظ: {new Date(printIntent.createdAt).toLocaleString('ar-EG')}</p>
          <p>الملاحظة: {printIntent.note || '—'}</p>
          <p>مفتاح الطلب: {printIntent.idempotencyKey}</p>
          <small>يجب إعادة المزامنة عند عودة الاتصال للحصول على الإغلاق النهائي من الخادم.</small>
        </div>
      </article> : null}
    </section>
  )
}
