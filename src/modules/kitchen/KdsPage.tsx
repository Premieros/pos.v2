import { useEffect, useMemo, useState } from 'react'
import { useBranch } from '../branches/useBranch'
import { usePermissions } from '../permissions/usePermissions'
import { listKitchenTickets, updateKitchenTicketStatus, type KitchenTicket } from './kitchen.service'

const statusLabel: Record<KitchenTicket['status'], string> = {
  queued: 'في الانتظار',
  preparing: 'قيد التحضير',
  ready: 'جاهز',
  completed: 'مكتمل',
  cancelled: 'ملغي',
}

export function KdsPage() {
  const { currentBranchId } = useBranch()
  const { can } = usePermissions()
  const [tickets, setTickets] = useState<KitchenTicket[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canView = can('kitchen.view') || can('kitchen.manage')
  const canUpdate = can('kitchen.ticket.update') || can('kitchen.manage')
  const branchId = currentBranchId

  async function refresh() {
    if (!branchId || !canView) return
    setLoading(true)
    setError(null)
    try {
      setTickets(await listKitchenTickets(branchId))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل شاشة المطبخ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    if (!branchId || !canView) return
    const timer = window.setInterval(() => { void refresh() }, 15000)
    return () => window.clearInterval(timer)
  }, [branchId, canView])

  const counters = useMemo(() => ({
    queued: tickets.filter((ticket) => ticket.status === 'queued').length,
    preparing: tickets.filter((ticket) => ticket.status === 'preparing').length,
    ready: tickets.filter((ticket) => ticket.status === 'ready').length,
  }), [tickets])

  if (!branchId || !canView) return null

  async function runStatus(ticketId: string, status: 'preparing' | 'ready' | 'completed') {
    setError(null)
    try {
      await updateKitchenTicketStatus(ticketId, status)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحديث حالة الطلب')
    }
  }

  return (
    <section className="workspace-card kds-workspace" aria-labelledby="kds-title">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">KITCHEN DISPLAY</p>
          <h2 id="kds-title">شاشة المطبخ</h2>
          <p>كل تذكرة تمثل Delta مستقلًا وصل للمطبخ، وليس إعادة إرسال كامل الطلب.</p>
        </div>
        <div className="pos-counters">
          <span>انتظار: {counters.queued}</span>
          <span>تحضير: {counters.preparing}</span>
          <span>جاهز: {counters.ready}</span>
        </div>
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {loading && !tickets.length ? <p>جارٍ تحميل طابور المطبخ…</p> : null}

      <div className="kds-grid">
        {tickets.map((ticket) => (
          <article key={ticket.id} className={`kds-ticket kds-${ticket.status}`}>
            <div className="kds-ticket-header">
              <div>
                <strong>طلب #{ticket.order_number ?? '—'}</strong>
                <span> · إرسال #{ticket.sequence_no}</span>
              </div>
              <span>{statusLabel[ticket.status]}</span>
            </div>

            <div className="kds-ticket-items">
              {ticket.items.map((item) => (
                <div key={item.id} className="kds-item-row">
                  <strong>{item.product_name}</strong>
                  <span className={item.quantity_delta < 0 ? 'negative-delta' : ''}>
                    {item.quantity_delta > 0 ? '+' : ''}{item.quantity_delta}
                  </span>
                </div>
              ))}
            </div>

            {canUpdate ? (
              <div className="kds-actions">
                {ticket.status === 'queued' ? <button type="button" onClick={() => void runStatus(ticket.id, 'preparing')}>بدء التحضير</button> : null}
                {ticket.status === 'preparing' ? <button type="button" onClick={() => void runStatus(ticket.id, 'ready')}>جاهز</button> : null}
                {ticket.status === 'ready' ? <button type="button" onClick={() => void runStatus(ticket.id, 'completed')}>إكمال</button> : null}
              </div>
            ) : null}
          </article>
        ))}
        {!tickets.length && !loading ? <p>لا توجد تذاكر مطبخ نشطة.</p> : null}
      </div>
    </section>
  )
}
