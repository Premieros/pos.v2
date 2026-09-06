import { useEffect, useMemo, useState } from 'react'
import { getProductModifierConfig, listOrderItemModifiers, setOrderItemModifiers, type ProductModifierConfig } from './modifier.service'
import './modifiers.css'

export function OrderItemModifierControls({
  branchId,
  orderItemId,
  productId,
  sentQuantity,
  canEdit,
  onChanged,
}: {
  branchId: string
  orderItemId: string
  productId: string
  sentQuantity: number
  canEdit: boolean
  onChanged: () => Promise<void> | void
}) {
  const [config, setConfig] = useState<ProductModifierConfig[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const [nextConfig, current] = await Promise.all([
        getProductModifierConfig(branchId, productId),
        listOrderItemModifiers(orderItemId),
      ])
      setConfig(nextConfig)
      setSelected(new Set(current.map((item) => item.modifier_option_id)))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل إضافات المنتج')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [branchId, productId, orderItemId])

  const optionMap = useMemo(() => new Map(config.flatMap((entry) => entry.options).map((option) => [option.id, option])), [config])
  const selectedOptions = useMemo(() => [...selected].map((id) => optionMap.get(id)).filter(Boolean), [selected, optionMap])
  const modifierTotal = selectedOptions.reduce((sum, option) => sum + Number(option?.price_delta ?? 0), 0)
  const locked = sentQuantity !== 0 || !canEdit

  if (loading || (!config.length && !error)) return null

  function toggle(group: ProductModifierConfig, optionId: string, checked: boolean) {
    if (locked) return
    setSelected((current) => {
      const next = new Set(current)
      const groupOptionIds = new Set(group.options.map((option) => option.id))
      const currentGroupCount = [...next].filter((id) => groupOptionIds.has(id)).length
      if (checked) {
        if (group.group.max_select === 1) {
          for (const id of groupOptionIds) next.delete(id)
        } else if (currentGroupCount >= group.group.max_select) {
          return current
        }
        next.add(optionId)
      } else {
        next.delete(optionId)
      }
      return next
    })
  }

  function validate() {
    for (const entry of config) {
      const ids = new Set(entry.options.map((option) => option.id))
      const count = [...selected].filter((id) => ids.has(id)).length
      if (count < entry.group.min_select) return `مجموعة «${entry.group.name_ar}» تتطلب ${entry.group.min_select} اختيار على الأقل.`
      if (count > entry.group.max_select) return `مجموعة «${entry.group.name_ar}» تسمح بحد أقصى ${entry.group.max_select}.`
    }
    return null
  }

  async function save() {
    const validation = validate()
    if (validation) { setError(validation); return }
    setSaving(true)
    setError(null)
    try {
      await setOrderItemModifiers(orderItemId, [...selected].map((optionId) => ({ optionId, quantity: 1 })))
      await onChanged()
      await refresh()
      setOpen(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر حفظ الإضافات')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="line-modifiers">
      <div className="line-modifiers-summary">
        <button type="button" onClick={() => setOpen((value) => !value)} disabled={!config.length}>
          {selected.size ? `الإضافات (${selected.size})` : 'تخصيص'}
        </button>
        {selectedOptions.length ? <span>{selectedOptions.map((option) => option?.name_ar).join('، ')}</span> : <span>بدون إضافات مختارة</span>}
        {modifierTotal ? <strong>{modifierTotal > 0 ? '+' : ''}{modifierTotal.toFixed(2)}</strong> : null}
      </div>

      {sentQuantity !== 0 ? <small className="modifier-lock-note">تم إرسال هذا السطر للمطبخ؛ لتغيير الإضافات احذف/اعكس السطر وأضف سطرًا جديدًا مخصصًا.</small> : null}
      {error ? <small className="error-text">{error}</small> : null}

      {open ? <div className="modifier-editor">
        {config.map((entry) => {
          const groupIds = new Set(entry.options.map((option) => option.id))
          const groupCount = [...selected].filter((id) => groupIds.has(id)).length
          return <fieldset key={entry.group.id} disabled={locked || saving}>
            <legend>{entry.group.name_ar} <small>{entry.group.min_select > 0 ? `مطلوب ${entry.group.min_select}` : 'اختياري'} · حد أقصى {entry.group.max_select}</small></legend>
            <div className="modifier-option-grid">
              {entry.options.map((option) => {
                const checked = selected.has(option.id)
                const limitReached = !checked && entry.group.max_select > 1 && groupCount >= entry.group.max_select
                return <label key={option.id} className={checked ? 'selected' : ''}>
                  <input type="checkbox" checked={checked} disabled={locked || saving || limitReached} onChange={(event) => toggle(entry, option.id, event.target.checked)} />
                  <span>{option.name_ar}</span>
                  <strong>{option.price_delta === 0 ? 'بدون زيادة' : `${option.price_delta > 0 ? '+' : ''}${Number(option.price_delta).toFixed(2)}`}</strong>
                </label>
              })}
            </div>
          </fieldset>
        })}
        {!locked ? <div className="modifier-editor-actions"><button type="button" disabled={saving} onClick={() => void save()}>{saving ? 'جارٍ الحفظ…' : 'حفظ التخصيص'}</button><button type="button" disabled={saving} onClick={() => setOpen(false)}>إغلاق</button></div> : null}
      </div> : null}
    </div>
  )
}
