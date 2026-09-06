import { useRef, useState } from 'react'
import { updateProductImageUrl, uploadProductImage, type Product } from './catalog.service'
import './product-media.css'

export function ProductMediaPanel({ products, mayManage, onChanged }: { products: Product[]; mayManage: boolean; onChanged: () => Promise<void> | void }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement | null>(null)
  const uploadProduct = useRef<Product | null>(null)

  async function save(productId: string) {
    if (!mayManage) return
    setSaving(true); setError(null)
    try { await updateProductImageUrl(productId, value || null); setEditingId(null); setValue(''); await onChanged() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر حفظ صورة المنتج') }
    finally { setSaving(false) }
  }

  async function upload(file: File | undefined) {
    const product = uploadProduct.current
    if (!mayManage || !product || !file) return
    setUploadingId(product.id); setError(null)
    try { await uploadProductImage(product, file); await onChanged() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر رفع صورة المنتج') }
    finally { setUploadingId(null); uploadProduct.current = null; if (fileInput.current) fileInput.current.value = '' }
  }

  return (
    <section className="catalog-panel product-media-panel">
      <div className="catalog-panel-heading"><h3>صور المنتجات</h3><span>{products.filter((product) => product.image_url).length}/{products.length}</span></div>
      <p className="muted-text">يمكن رفع صورة مباشرة (JPG/PNG/WebP/GIF حتى 5MB) أو استخدام رابط خارجي. الرفع مقيد بصلاحية catalog.manage وبفرع المنتج.</p>
      {error ? <p className="error-text">{error}</p> : null}
      <input ref={fileInput} className="product-media-file-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => void upload(event.target.files?.[0])} />
      <div className="product-media-grid">
        {products.map((product) => (
          <article key={product.id} className="product-media-card">
            <div className="product-media-preview" aria-label={`صورة ${product.name_ar}`}>{product.image_url ? <img src={product.image_url} alt={product.name_ar} loading="lazy" /> : <span>{product.name_ar.slice(0, 1)}</span>}</div>
            <div className="product-media-info"><strong>{product.name_ar}</strong><small>{product.sku || 'بدون SKU'}</small></div>
            {mayManage ? <div className="product-media-actions">
              <button type="button" disabled={uploadingId === product.id} onClick={() => { uploadProduct.current = product; fileInput.current?.click() }}>{uploadingId === product.id ? 'جارٍ الرفع…' : 'رفع صورة'}</button>
              {editingId === product.id ? <div className="product-media-edit"><input value={value} onChange={(event) => setValue(event.target.value)} placeholder="https://…" aria-label={`رابط صورة ${product.name_ar}`} /><button type="button" disabled={saving} onClick={() => void save(product.id)}>حفظ</button><button type="button" disabled={saving} onClick={() => { setEditingId(null); setValue('') }}>إلغاء</button></div> : <button type="button" onClick={() => { setEditingId(product.id); setValue(product.image_url ?? '') }}>استخدام رابط</button>}
            </div> : null}
          </article>
        ))}
      </div>
    </section>
  )
}
