import { useEffect, useMemo, useState } from 'react'
import { useBranch } from '../branches/useBranch'
import { usePermissions } from '../permissions/usePermissions'
import { registerFirstReceiptPrint, registerReceiptReprint, type ReceiptPrintResult } from '../receipts/receipt.service'
import { getDaySummary, listPrintableKitchenTickets, listPrintableOrders, listPrintableShifts, type PrintableOrder } from './printing.service'
import type { KitchenTicket } from '../kitchen/kitchen.service'
import type { Shift } from '../shifts/shift.service'
import type { ReportData } from '../reports/report.service'
import './printing.css'

type PrintKind = 'receipt' | 'kitchen' | 'shift' | 'day'

type PrintPayload =
  | { kind: 'receipt'; receipt: ReceiptPrintResult }
  | { kind: 'kitchen'; ticket: KitchenTicket }
  | { kind: 'shift'; shift: Shift }
  | { kind: 'day'; date: string; summary: ReportData }

function money(value: unknown) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? number.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'
}

export function PrintingCenterPage() {
  const { currentBranchId, currentBranch } = useBranch()
  const { can } = usePermissions()
  const [kind, setKind] = useState<PrintKind>('receipt')
  const [orders, setOrders] = useState<PrintableOrder[]>([])
  const [tickets, setTickets] = useState<KitchenTicket[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [orderId, setOrderId] = useState('')
  const [ticketId, setTicketId] = useState('')
  const [shiftId, setShiftId] = useState('')
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10))
  const [payload, setPayload] = useState<PrintPayload | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canReceiptPrint = can('pos.receipt.print')
  const canReceiptReprint = can('pos.receipt.reprint')
  const canKitchen = can('kitchen.view') || can('kitchen.manage')
  const canShift = can('shifts.view') || can('shifts.manage')
  const canDay = can('reports.view')
  const canOpen = canReceiptPrint || canReceiptReprint || canKitchen || canShift || canDay

  useEffect(() => {
    if (!currentBranchId || !canOpen) return
    setError(null)
    void Promise.all([
      canReceiptPrint || canReceiptReprint ? listPrintableOrders(currentBranchId) : Promise.resolve([]),
      canKitchen ? listPrintableKitchenTickets(currentBranchId) : Promise.resolve([]),
      canShift ? listPrintableShifts(currentBranchId) : Promise.resolve([]),
    ]).then(([nextOrders, nextTickets, nextShifts]) => {
      setOrders(nextOrders)
      setTickets(nextTickets)
      setShifts(nextShifts)
      setOrderId((value) => value || nextOrders[0]?.id || '')
      setTicketId((value) => value || nextTickets[0]?.id || '')
      setShiftId((value) => value || nextShifts[0]?.id || '')
    }).catch((cause) => setError(cause instanceof Error ? cause.message : 'تعذر تحميل مركز الطباعة'))
  }, [currentBranchId, canOpen, canReceiptPrint, canReceiptReprint, canKitchen, canShift])

  const selectedTicket = useMemo(() => tickets.find((ticket) => ticket.id === ticketId) ?? null, [tickets, ticketId])
  const selectedShift = useMemo(() => shifts.find((shift) => shift.id === shiftId) ?? null, [shifts, shiftId])

  if (!currentBranchId || !canOpen) return null

  const runAndPrint = async (action: () => Promise<PrintPayload>) => {
    setBusy(true)
    setError(null)
    try {
      const next = await action()
      setPayload(next)
      window.setTimeout(() => window.print(), 80)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تجهيز الطباعة')
    } finally {
      setBusy(false)
    }
  }

  const printReceipt = async () => {
    if (!orderId) return
    if (canReceiptReprint) {
      const reason = window.prompt('سبب إعادة الطباعة. اتركه فارغًا لاستخدام الطباعة الأولى إذا لم يسبق طباعة الإيصال.')
      if (reason?.trim()) {
        await runAndPrint(async () => ({ kind: 'receipt', receipt: await registerReceiptReprint(orderId, reason) }))
        return
      }
    }
    if (!canReceiptPrint) throw new Error('لا توجد صلاحية للطباعة الأولى')
    await runAndPrint(async () => ({ kind: 'receipt', receipt: await registerFirstReceiptPrint(orderId) }))
  }

  return (
    <section className="workspace-card printing-center" aria-labelledby="printing-title">
      <div className="workspace-heading"><div><p className="eyebrow">PRINTING</p><h2 id="printing-title">مركز الطباعة</h2><p>طباعة مركزية تستخدم نفس عقود الإيصال والمطبخ والورديات والتقارير بدون تجاوز الصلاحيات.</p></div></div>
      {error ? <p className="error-text">{error}</p> : null}

      <div className="printing-tabs">
        {(canReceiptPrint || canReceiptReprint) ? <button type="button" className={kind === 'receipt' ? 'active' : ''} onClick={() => setKind('receipt')}>الإيصالات</button> : null}
        {canKitchen ? <button type="button" className={kind === 'kitchen' ? 'active' : ''} onClick={() => setKind('kitchen')}>المطبخ</button> : null}
        {canShift ? <button type="button" className={kind === 'shift' ? 'active' : ''} onClick={() => setKind('shift')}>الورديات</button> : null}
        {canDay ? <button type="button" className={kind === 'day' ? 'active' : ''} onClick={() => setKind('day')}>ملخص اليوم</button> : null}
      </div>

      {kind === 'receipt' && (canReceiptPrint || canReceiptReprint) ? <div className="printing-form"><label>الفاتورة<select value={orderId} onChange={(event) => setOrderId(event.target.value)}><option value="">اختر فاتورة</option>{orders.map((order) => <option key={order.id} value={order.id}>#{order.order_number} — {money(order.total)} — {new Date(order.created_at).toLocaleString('ar-EG')}</option>)}</select></label><button type="button" disabled={busy || !orderId} onClick={() => void printReceipt()}>تجهيز وطباعة الإيصال</button><small>إعادة الطباعة تسجل حدثًا جديدًا وتستخدم Snapshot الإيصال الثابت؛ لا تعيد بناء الفاتورة من بيانات متغيرة.</small></div> : null}

      {kind === 'kitchen' && canKitchen ? <div className="printing-form"><label>تذكرة المطبخ<select value={ticketId} onChange={(event) => setTicketId(event.target.value)}><option value="">اختر تذكرة</option>{tickets.map((ticket) => <option key={ticket.id} value={ticket.id}>طلب #{ticket.order_number ?? '—'} / إرسال #{ticket.sequence_no}</option>)}</select></label><button type="button" disabled={busy || !selectedTicket} onClick={() => selectedTicket && void runAndPrint(async () => ({ kind: 'kitchen', ticket: selectedTicket }))}>طباعة تذكرة المطبخ</button><small>الطباعة قراءة فقط ولا تغير حالة KDS أو المخزون.</small></div> : null}

      {kind === 'shift' && canShift ? <div className="printing-form"><label>الوردية<select value={shiftId} onChange={(event) => setShiftId(event.target.value)}><option value="">اختر وردية</option>{shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.status === 'closed' ? 'مغلقة' : 'مفتوحة'} — {new Date(shift.opened_at).toLocaleString('ar-EG')}</option>)}</select></label><button type="button" disabled={busy || !selectedShift} onClick={() => selectedShift && void runAndPrint(async () => ({ kind: 'shift', shift: selectedShift }))}>طباعة ملخص الوردية</button></div> : null}

      {kind === 'day' && canDay ? <div className="printing-form"><label>التاريخ<input type="date" value={day} onChange={(event) => setDay(event.target.value)} /></label><button type="button" disabled={busy || !day} onClick={() => void runAndPrint(async () => ({ kind: 'day', date: day, summary: await getDaySummary(currentBranchId, day) }))}>طباعة ملخص اليوم</button><small>ملخص اليوم يستخدم نفس تقرير المبيعات المصرح به ولا ينشئ عقد إغلاق يوم جديدًا.</small></div> : null}

      {payload ? <article className="central-print-root" dir="rtl">
        <div className="central-print-paper">
          <h2>{currentBranch?.name_ar ?? 'POS.V2'}</h2>
          {payload.kind === 'receipt' ? <><h3>إيصال بيع</h3><p>طلب #{payload.receipt.snapshot.order.order_number}</p>{payload.receipt.snapshot.items.map((item) => <div className="central-print-line" key={item.id}><span>{item.product_name} × {item.quantity}</span><strong>{money(item.line_total)}</strong></div>)}<hr/><p>الخصم: {money(payload.receipt.snapshot.order.discount_total)}</p><p><strong>الإجمالي: {money(payload.receipt.snapshot.order.total)}</strong></p><small>{payload.receipt.event_type === 'reprint' ? `إعادة طباعة #${payload.receipt.sequence}` : 'الطباعة الأولى'}</small></> : null}
          {payload.kind === 'kitchen' ? <><h3>تذكرة مطبخ</h3><p>طلب #{payload.ticket.order_number ?? '—'} / إرسال #{payload.ticket.sequence_no}</p><p>{new Date(payload.ticket.created_at).toLocaleString('ar-EG')}</p>{payload.ticket.items.map((item) => <div className="central-print-line" key={item.id}><span>{item.product_name}</span><strong>{item.quantity_delta}</strong></div>)}</> : null}
          {payload.kind === 'shift' ? <><h3>ملخص وردية</h3><p>الحالة: {payload.shift.status === 'closed' ? 'مغلقة' : 'مفتوحة'}</p><p>فتح: {new Date(payload.shift.opened_at).toLocaleString('ar-EG')}</p><p>إغلاق: {payload.shift.closed_at ? new Date(payload.shift.closed_at).toLocaleString('ar-EG') : '—'}</p><p>رصيد البداية: {money(payload.shift.opening_balance)}</p><p>النقد المتوقع: {money(payload.shift.expected_cash)}</p><p>النقد الفعلي: {money(payload.shift.actual_cash)}</p><p>الفرق: {money(payload.shift.cash_difference)}</p></> : null}
          {payload.kind === 'day' ? <><h3>ملخص يوم {payload.date}</h3>{Object.entries(payload.summary.totals).map(([key, value]) => <div className="central-print-line" key={key}><span>{key}</span><strong>{money(value)}</strong></div>)}</> : null}
        </div>
      </article> : null}
    </section>
  )
}
