import { useState } from 'react'
import { updateProductImageUrl, type Product } from './catalog.service'
import './product-media.css'

export function ProductMediaPanel({ products, mayManage, onChanged }: { products: Product[]; mayManage: boolean; onChanged: () => Promise<void> | void }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(productId: string) {
    if (!mayManage) return
    setSaving(true)
    setError(null)
    try {
      await updateProductImageUrl(productId, value || null)
      setEditingId(null)
      setValue('')
      await onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر حفظ صورة المنتج')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="catalog-panel product-media-panel">
      <div className="catalog-panel-heading"><h3>صور المنتجات</h3><span>{products.filter((product) => product.image_url).length}/{products.length}</span></div>
      <p className="muted-text">يتم حفظ رابط الصورة ضمن عقد المنتج بصلاحية catalog.manage. عند غياب الصورة يستخدم POS fallback واضح.</p>
      {error ? <p className="error-text">{error}</p> : null}
      <div className="product-media-grid">
        {products.map((product) => (
          <article key={product.id} className="product-media-card">
            <div className="product-media-preview" aria-label={`صورة ${product.name_ar}`}>
              {product.image_url ? <img src={product.image_url} alt={product.name_ar} loading="lazy" /> : <span>{product.name_ar.slice(0, 1)}</span>}
            </div>
            <div className="product-media-info">
              <strong>{product.name_ar}</strong>
              <small>{product.sku || 'بدون SKU'}</small>
            </div>
            {mayManage ? editingId === product.id ? (
              <div className="product-media-edit">
                <input value={value} onChange={(event) => setValue(event.target.value)} placeholder="https://…" aria-label={`رابط صورة ${product.name_ar}`} />
                <button type="button" disabled={saving} onClick={() => void save(product.id)}>حفظ</button>
                <button type="button" disabled={saving} onClick={() => { setEditingId(null); setValue('') }}>إلغاء</button>
              </div>
            ) : (
              <button type="button" onClick={() => { setEditingId(product.id); setValue(product.image_url ?? '') }}>{product.image_url ? 'تغيير الصورة' : 'إضافة صورة'}</button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}
