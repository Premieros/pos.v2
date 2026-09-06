import { useEffect, useState } from 'react'
import { updateOrderItemNotes, updateOrderNotes } from './notes.service'

export function OrderNotesControls({
  orderId,
  value,
  editable,
  onChanged,
}: {
  orderId: string
  value: string | null
  editable: boolean
  onChanged: () => Promise<void> | void
}) {
  const [notes, setNotes] = useState(value ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setNotes(value ?? ''), [orderId, value])

  async function save() {
    if (!editable) return
    setSaving(true)
    setError(null)
    try {
      await updateOrderNotes(orderId, notes)
      await onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر حفظ ملاحظة الطلب')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pos-note-control">
      <label><span>ملاحظة الطلب</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="ملاحظة عامة قبل الإرسال للمطبخ" disabled={!editable || saving} /></label>
      {editable ? <button type="button" disabled={saving || notes === (value ?? '')} onClick={() => void save()}>{saving ? 'جارٍ الحفظ…' : 'حفظ الملاحظة'}</button> : <small>ملاحظات الطلب مقفلة بعد أول إرسال للمطبخ.</small>}
      {error ? <small className="error-text">{error}</small> : null}
    </div>
  )
}

export function OrderItemNotesControls({
  orderItemId,
  value,
  editable,
  onChanged,
}: {
  orderItemId: string
  value: string | null
  editable: boolean
  onChanged: () => Promise<void> | void
}) {
  const [notes, setNotes] = useState(value ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setNotes(value ?? ''), [orderItemId, value])

  async function save() {
    if (!editable) return
    setSaving(true)
    setError(null)
    try {
      await updateOrderItemNotes(orderItemId, notes)
      await onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر حفظ ملاحظة السطر')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pos-line-note-control">
      <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="ملاحظة للمطبخ" disabled={!editable || saving} aria-label="ملاحظة السطر للمطبخ" />
      {editable ? <button type="button" disabled={saving || notes === (value ?? '')} onClick={() => void save()}>حفظ</button> : null}
      {error ? <small className="error-text">{error}</small> : null}
    </div>
  )
}
