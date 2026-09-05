import { useEffect, useMemo, useState } from 'react'
import { useBranch } from '../branches/useBranch'
import { usePermissions } from '../permissions/usePermissions'
import { closeShift, listShifts, openShift, recordCashMovement, type Shift } from './shift.service'

export function ShiftsPage() {
  const { currentBranchId } = useBranch()
  const { can } = usePermissions()
  const [shifts, setShifts] = useState<Shift[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const canView = can('shifts.view') || can('shifts.manage') || can('shifts.open') || can('shifts.close') || can('shifts.cash.move')
  const canOpen = can('shifts.open') || can('shifts.manage')
  const canClose = can('shifts.close') || can('shifts.manage')
  const canMoveCash = can('shifts.cash.move') || can('shifts.manage')

  async function refresh() {
    if (!currentBranchId || !canView) return
    setLoading(true)
    setError(null)
    try { setShifts(await listShifts(currentBranchId)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر تحميل الورديات') }
    finally { setLoading(false) }
  }

  useEffect(() => { void refresh() }, [currentBranchId, canView])

  const openCurrent = useMemo(() => shifts.find((shift) => shift.status === 'open') ?? null, [shifts])

  if (!currentBranchId || !canView) return null
  const branchId = currentBranchId

  async function run(action: () => Promise<void>) {
    setError(null)
    try { await action(); await refresh() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر تنفيذ العملية') }
  }

  return (
    <section className="workspace-card" aria-labelledby="shifts-title">
      <div className="workspace-heading">
        <div><p className="eyebrow">SHIFTS</p><h2 id="shifts-title">الورديات والدرج</h2><p>فتح وإغلاق الوردية وحركات النقدية بعقود خادمية مستقلة.</p></div>
      </div>
      {error ? <p className="error-text">{error}</p> : null}
      {loading ? <p>جارٍ تحميل الورديات…</p> : null}

      {!openCurrent && canOpen ? (
        <form className="inline-form" onSubmit={(event) => { event.preventDefault(); const form=event.currentTarget; const data=new FormData(form); void run(async()=>{ await openShift(branchId, Number(data.get('openingBalance') ?? 0)); form.reset() }) }}>
          <h3>فتح وردية</h3>
          <input name="openingBalance" type="number" min="0" step="0.01" required placeholder="رصيد بداية الدرج" />
          <button type="submit">فتح الوردية</button>
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
              <button type="submit">تسجيل الحركة</button>
            </form>
          ) : null}

          {canClose ? (
            <form className="inline-form" onSubmit={(event)=>{event.preventDefault(); const form=event.currentTarget; const data=new FormData(form); void run(async()=>{ await closeShift({ shiftId: openCurrent.id, branchId, actualCash:Number(data.get('actualCash')??0), note:String(data.get('note')??'') }); form.reset() })}}>
              <h3>إغلاق الوردية</h3>
              <input name="actualCash" type="number" min="0" step="0.01" required placeholder="النقدية الفعلية" />
              <input name="note" placeholder="ملاحظة الإغلاق" />
              <button type="submit">إغلاق الوردية</button>
            </form>
          ) : null}
        </div>
      ) : null}

      <div className="table-wrap">
        <table>
          <thead><tr><th>الحالة</th><th>بداية الدرج</th><th>المتوقع</th><th>الفعلي</th><th>الفرق</th><th>فتح</th><th>إغلاق</th></tr></thead>
          <tbody>
            {shifts.map((shift)=><tr key={shift.id}><td>{shift.status === 'open' ? 'مفتوحة' : 'مغلقة'}</td><td>{shift.opening_balance}</td><td>{shift.expected_cash ?? '—'}</td><td>{shift.actual_cash ?? '—'}</td><td>{shift.cash_difference ?? '—'}</td><td>{new Date(shift.opened_at).toLocaleString('ar-EG')}</td><td>{shift.closed_at ? new Date(shift.closed_at).toLocaleString('ar-EG') : '—'}</td></tr>)}
            {!shifts.length && !loading ? <tr><td colSpan={7}>لا توجد ورديات بعد.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}
