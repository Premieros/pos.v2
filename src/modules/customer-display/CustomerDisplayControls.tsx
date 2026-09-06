import { useEffect, useRef, useState } from 'react'
import type { PosOrder } from '../pos/pos.service'
import { getCustomerDisplayProjection, type CustomerDisplayProjection } from './customer-display.service'
import './customer-display.css'

type Props = { order: PosOrder }

export function CustomerDisplayControls({ order }: Props) {
  const popupRef = useRef<Window | null>(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function renderProjection(popup: Window, projection: CustomerDisplayProjection) {
    const doc = popup.document
    doc.title = `طلب #${projection.order.order_number}`
    doc.documentElement.dir = 'rtl'
    doc.body.replaceChildren()
    doc.body.className = 'customer-display-body'

    const root = doc.createElement('main')
    root.className = 'customer-display-screen'

    const header = doc.createElement('header')
    const title = doc.createElement('h1')
    title.textContent = `طلب #${projection.order.order_number}`
    const state = doc.createElement('p')
    state.textContent = projection.order.status
    header.append(title, state)

    const items = doc.createElement('section')
    items.className = 'customer-display-items'
    for (const item of projection.items) {
      const row = doc.createElement('div')
      const name = doc.createElement('span')
      name.textContent = `${item.product_name} × ${item.quantity}`
      const total = doc.createElement('strong')
      total.textContent = Number(item.line_total).toFixed(2)
      row.append(name, total)
      items.append(row)
    }

    const totals = doc.createElement('section')
    totals.className = 'customer-display-totals'
    const rows: Array<[string, number]> = [
      ['الإجمالي قبل الخصم', projection.order.subtotal],
      ['الخصم', projection.order.discount_total],
      ['الإجمالي', projection.order.total],
      ['المدفوع', projection.payment.paid],
      ['المتبقي', projection.payment.remaining],
    ]
    for (const [label, value] of rows) {
      const row = doc.createElement('div')
      const text = doc.createElement('span')
      text.textContent = label
      const amount = doc.createElement('strong')
      amount.textContent = Number(value).toFixed(2)
      row.append(text, amount)
      totals.append(row)
    }

    const footer = doc.createElement('footer')
    footer.textContent = 'شكرًا لزيارتكم'
    root.append(header, items, totals, footer)
    doc.body.append(root)

    const style = doc.createElement('style')
    style.textContent = `
      *{box-sizing:border-box} body{margin:0;background:#0f172a;color:#f8fafc;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
      .customer-display-screen{min-height:100vh;padding:48px;display:grid;grid-template-rows:auto 1fr auto auto;gap:28px}
      header{display:flex;justify-content:space-between;align-items:center;gap:20px} h1{font-size:clamp(2rem,5vw,4rem);margin:0} header p{font-size:1.25rem;margin:0;color:#cbd5e1}
      .customer-display-items{display:grid;align-content:start;gap:12px}.customer-display-items>div,.customer-display-totals>div{display:flex;justify-content:space-between;gap:20px;padding:14px 0;border-bottom:1px solid #334155;font-size:clamp(1.1rem,2.4vw,1.8rem)}
      .customer-display-totals{display:grid;gap:4px}.customer-display-totals>div:nth-last-child(-n+3){font-size:clamp(1.35rem,3vw,2.3rem)} footer{text-align:center;color:#cbd5e1;font-size:1.2rem}
    `
    doc.head.replaceChildren(style)
  }

  async function refreshPopup() {
    const popup = popupRef.current
    if (!popup || popup.closed) {
      setOpen(false)
      return
    }
    try {
      const projection = await getCustomerDisplayProjection(order.id)
      renderProjection(popup, projection)
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحديث شاشة العميل')
    }
  }

  useEffect(() => {
    if (!open) return
    void refreshPopup()
    const timer = window.setInterval(() => void refreshPopup(), 2000)
    return () => window.clearInterval(timer)
  }, [open, order.id])

  useEffect(() => () => popupRef.current?.close(), [])

  function openDisplay() {
    const popup = window.open('', 'pos-v2-customer-display', 'popup,width=960,height=720')
    if (!popup) {
      setError('تعذر فتح نافذة العميل. اسمح بالنوافذ المنبثقة لهذا الموقع.')
      return
    }
    popupRef.current = popup
    setOpen(true)
    void refreshPopup()
  }

  function closeDisplay() {
    popupRef.current?.close()
    popupRef.current = null
    setOpen(false)
  }

  return (
    <section className="customer-display-controls" aria-label="شاشة العميل">
      <div>
        <strong>شاشة العميل</strong>
        <p className="muted-text">نافذة قراءة فقط تعرض الأصناف والإجمالي والمدفوع والمتبقي وتتحدث تلقائيًا.</p>
      </div>
      <div>
        {!open ? <button type="button" onClick={openDisplay}>فتح شاشة العميل</button> : <button type="button" onClick={closeDisplay}>إغلاق شاشة العميل</button>}
      </div>
      {error ? <p className="error-text">{error}</p> : null}
    </section>
  )
}
