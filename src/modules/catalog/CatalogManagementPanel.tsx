import { useState, type FormEvent } from 'react'
import { updateCategory, updateProduct, type Category, type Product } from './catalog.service'

export function CatalogManagementPanel({
  categories,
  products,
  mayManage,
  onChanged,
}: {
  categories: Category[]
  products: Product[]
  mayManage: boolean
  onChanged: () => Promise<void> | void
}) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('')
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!mayManage) return null

  const selectedCategory = categories.find((category) => category.id === selectedCategoryId) ?? null
  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? null

  async function handleCategoryUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedCategory) return
    const form = new FormData(event.currentTarget)
    setSaving(true)
    setError(null)
    try {
      await updateCategory({
        categoryId: selectedCategory.id,
        nameAr: String(form.get('nameAr') ?? ''),
        nameEn: String(form.get('nameEn') ?? ''),
        sortOrder: Number(form.get('sortOrder') ?? 0),
        isActive: form.get('isActive') === 'on',
      })
      await onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحديث التصنيف')
    } finally {
      setSaving(false)
    }
  }

  async function handleProductUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedProduct) return
    const form = new FormData(event.currentTarget)
    setSaving(true)
    setError(null)
    try {
      await updateProduct({
        productId: selectedProduct.id,
        categoryId: String(form.get('categoryId') ?? '') || null,
        sku: String(form.get('sku') ?? ''),
        barcode: String(form.get('barcode') ?? ''),
        nameAr: String(form.get('nameAr') ?? ''),
        nameEn: String(form.get('nameEn') ?? ''),
        salePrice: Number(form.get('salePrice') ?? 0),
        isActive: form.get('isActive') === 'on',
      })
      await onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحديث المنتج')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="catalog-panel catalog-management-panel" aria-labelledby="catalog-management-title">
      <div className="catalog-panel-heading">
        <div>
          <h3 id="catalog-management-title">تعديل الكتالوج</h3>
          <p className="muted-text">تعديل المنتج وحالته، وترتيب التصنيفات بدون إنشاء مسار كتابة مباشر.</p>
        </div>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="catalog-management-grid">
        <div className="catalog-form">
          <h4>التصنيف</h4>
          <select aria-label="اختيار تصنيف للتعديل" value={selectedCategoryId} onChange={(event) => setSelectedCategoryId(event.target.value)}>
            <option value="">اختر تصنيفًا</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name_ar}</option>)}
          </select>
          {selectedCategory ? (
            <form key={selectedCategory.id} className="catalog-form" onSubmit={handleCategoryUpdate}>
              <input name="nameAr" defaultValue={selectedCategory.name_ar} required placeholder="الاسم بالعربية" />
              <input name="nameEn" defaultValue={selectedCategory.name_en ?? ''} placeholder="الاسم بالإنجليزية" />
              <input name="sortOrder" type="number" step="1" defaultValue={selectedCategory.sort_order} required placeholder="الترتيب" />
              <label className="compact-check"><input name="isActive" type="checkbox" defaultChecked={selectedCategory.is_active} /> نشط</label>
              <button type="submit" disabled={saving}>حفظ التصنيف</button>
            </form>
          ) : null}
        </div>

        <div className="catalog-form">
          <h4>المنتج</h4>
          <select aria-label="اختيار منتج للتعديل" value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)}>
            <option value="">اختر منتجًا</option>
            {products.map((product) => <option key={product.id} value={product.id}>{product.name_ar}</option>)}
          </select>
          {selectedProduct ? (
            <form key={selectedProduct.id} className="catalog-form" onSubmit={handleProductUpdate}>
              <select name="categoryId" defaultValue={selectedProduct.category_id ?? ''}>
                <option value="">بدون تصنيف</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name_ar}</option>)}
              </select>
              <input name="sku" defaultValue={selectedProduct.sku ?? ''} placeholder="SKU" />
              <input name="barcode" defaultValue={selectedProduct.barcode ?? ''} placeholder="Barcode" />
              <input name="nameAr" defaultValue={selectedProduct.name_ar} required placeholder="الاسم بالعربية" />
              <input name="nameEn" defaultValue={selectedProduct.name_en ?? ''} placeholder="الاسم بالإنجليزية" />
              <input name="salePrice" type="number" min="0" step="0.01" defaultValue={selectedProduct.sale_price} required placeholder="سعر البيع" />
              <label className="compact-check"><input name="isActive" type="checkbox" defaultChecked={selectedProduct.is_active} /> نشط</label>
              <button type="submit" disabled={saving}>حفظ المنتج</button>
            </form>
          ) : null}
        </div>
      </div>
    </section>
  )
}
