import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Product } from '../catalog/catalog.service'
import {
  createModifierGroup,
  createModifierOption,
  listModifierGroups,
  listModifierInventoryItems,
  listModifierOptions,
  listProductModifierGroupIds,
  setProductModifierGroups,
  type ModifierGroup,
  type ModifierInventoryItem,
  type ModifierOption,
} from './modifier.service'

export function ModifierCatalogPanel({
  branchId,
  products,
  mayManage,
}: {
  branchId: string
  products: Product[]
  mayManage: boolean
}) {
  const [groups, setGroups] = useState<ModifierGroup[]>([])
  const [options, setOptions] = useState<ModifierOption[]>([])
  const [inventoryItems, setInventoryItems] = useState<ModifierInventoryItem[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [assignedGroupIds, setAssignedGroupIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeGroups = useMemo(() => groups.filter((group) => group.is_active), [groups])
  const activeProducts = useMemo(() => products.filter((product) => product.is_active), [products])

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const [nextGroups, nextOptions, nextItems] = await Promise.all([
        listModifierGroups(branchId),
        listModifierOptions(branchId),
        listModifierInventoryItems(branchId),
      ])
      setGroups(nextGroups)
      setOptions(nextOptions)
      setInventoryItems(nextItems)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل إعدادات الإضافات')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [branchId])

  useEffect(() => {
    if (!selectedProductId) {
      setAssignedGroupIds(new Set())
      return
    }
    let active = true
    void listProductModifierGroupIds(branchId, selectedProductId)
      .then((ids) => { if (active) setAssignedGroupIds(new Set(ids)) })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'تعذر تحميل ربط المنتج') })
    return () => { active = false }
  }, [branchId, selectedProductId])

  async function run(action: () => Promise<void>) {
    setSaving(true)
    setError(null)
    try {
      await action()
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر حفظ إعدادات الإضافات')
    } finally {
      setSaving(false)
    }
  }

  async function handleGroupSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!mayManage) return
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const minSelect = Number(form.get('minSelect') ?? 0)
    const maxSelect = Number(form.get('maxSelect') ?? 1)
    await run(async () => {
      await createModifierGroup({
        branchId,
        code: String(form.get('code') ?? ''),
        nameAr: String(form.get('nameAr') ?? ''),
        nameEn: String(form.get('nameEn') ?? ''),
        minSelect,
        maxSelect,
      })
      formElement.reset()
    })
  }

  async function handleOptionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!mayManage) return
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const inventoryItemId = String(form.get('inventoryItemId') ?? '') || null
    await run(async () => {
      await createModifierOption({
        groupId: String(form.get('groupId') ?? ''),
        code: String(form.get('code') ?? ''),
        nameAr: String(form.get('nameAr') ?? ''),
        nameEn: String(form.get('nameEn') ?? ''),
        priceDelta: Number(form.get('priceDelta') ?? 0),
        inventoryItemId,
        inventoryQuantity: inventoryItemId ? Number(form.get('inventoryQuantity') ?? 0) : 0,
      })
      formElement.reset()
    })
  }

  async function saveProductAssignment() {
    if (!mayManage || !selectedProductId) return
    setSaving(true)
    setError(null)
    try {
      const orderedIds = activeGroups.filter((group) => assignedGroupIds.has(group.id)).map((group) => group.id)
      await setProductModifierGroups(selectedProductId, orderedIds)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر حفظ ربط المنتج')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="catalog-panel modifier-catalog-panel" aria-labelledby="modifier-catalog-title">
      <div className="catalog-panel-heading">
        <div>
          <h3 id="modifier-catalog-title">الإضافات والتخصيص</h3>
          <small>مجموعات خيارات مرتبطة بالمنتج والسعر والمخزون عند الحاجة.</small>
        </div>
        <span>{activeGroups.length} مجموعة</span>
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {loading ? <p className="muted-text">جارٍ تحميل الإضافات…</p> : null}

      {mayManage ? <div className="modifier-catalog-forms">
        <form className="catalog-form" onSubmit={handleGroupSubmit}>
          <h4>مجموعة جديدة</h4>
          <input name="code" placeholder="الكود" required />
          <input name="nameAr" placeholder="اسم المجموعة بالعربية" required />
          <input name="nameEn" placeholder="الاسم بالإنجليزية" />
          <div className="modifier-bounds-row">
            <label><span>الحد الأدنى</span><input name="minSelect" type="number" min="0" defaultValue="0" required /></label>
            <label><span>الحد الأقصى</span><input name="maxSelect" type="number" min="1" defaultValue="1" required /></label>
          </div>
          <button type="submit" disabled={saving}>إضافة المجموعة</button>
        </form>

        <form className="catalog-form" onSubmit={handleOptionSubmit}>
          <h4>خيار جديد</h4>
          <select name="groupId" required defaultValue="">
            <option value="" disabled>اختر المجموعة</option>
            {activeGroups.map((group) => <option key={group.id} value={group.id}>{group.name_ar}</option>)}
          </select>
          <input name="code" placeholder="كود الخيار" required />
          <input name="nameAr" placeholder="اسم الخيار بالعربية" required />
          <input name="nameEn" placeholder="الاسم بالإنجليزية" />
          <input name="priceDelta" type="number" step="0.01" defaultValue="0" placeholder="فرق السعر" />
          <select name="inventoryItemId" defaultValue="">
            <option value="">بدون خصم مخزون إضافي</option>
            {inventoryItems.map((item) => <option key={item.id} value={item.id}>{item.name_ar} · {item.base_unit}</option>)}
          </select>
          <input name="inventoryQuantity" type="number" min="0" step="0.001" defaultValue="0" placeholder="كمية المخزون لكل وحدة" />
          <button type="submit" disabled={saving || !activeGroups.length}>إضافة الخيار</button>
        </form>
      </div> : null}

      <div className="modifier-group-list">
        {activeGroups.map((group) => (
          <article key={group.id} className="modifier-group-card">
            <div>
              <strong>{group.name_ar}</strong>
              <span>{group.min_select > 0 ? `مطلوب ${group.min_select}` : 'اختياري'} · أقصى {group.max_select}</span>
            </div>
            <div className="modifier-option-summary">
              {options.filter((option) => option.group_id === group.id && option.is_active).map((option) => (
                <span key={option.id}>{option.name_ar}{option.price_delta ? ` (${option.price_delta > 0 ? '+' : ''}${option.price_delta.toFixed(2)})` : ''}</span>
              ))}
              {!options.some((option) => option.group_id === group.id && option.is_active) ? <em>لا توجد خيارات بعد</em> : null}
            </div>
          </article>
        ))}
        {!activeGroups.length && !loading ? <p className="muted-text">لا توجد مجموعات إضافات بعد.</p> : null}
      </div>

      {mayManage ? <div className="modifier-product-assignment">
        <h4>ربط المجموعات بمنتج</h4>
        <select value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)}>
          <option value="">اختر المنتج</option>
          {activeProducts.map((product) => <option key={product.id} value={product.id}>{product.name_ar}</option>)}
        </select>
        {selectedProductId ? <div className="modifier-assignment-grid">
          {activeGroups.map((group) => (
            <label key={group.id} className={assignedGroupIds.has(group.id) ? 'selected' : ''}>
              <input
                type="checkbox"
                checked={assignedGroupIds.has(group.id)}
                onChange={(event) => setAssignedGroupIds((current) => {
                  const next = new Set(current)
                  if (event.target.checked) next.add(group.id)
                  else next.delete(group.id)
                  return next
                })}
              />
              <span>{group.name_ar}</span>
            </label>
          ))}
        </div> : null}
        <button type="button" disabled={!selectedProductId || saving} onClick={() => void saveProductAssignment()}>حفظ ربط المنتج</button>
      </div> : null}
    </section>
  )
}
