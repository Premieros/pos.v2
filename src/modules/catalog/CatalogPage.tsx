import { useEffect, useState, type FormEvent } from 'react'
import { useBranch } from '../branches/useBranch'
import { usePermissions } from '../permissions/usePermissions'
import {
  createCategory,
  createProduct,
  listCategories,
  listProducts,
  type Category,
  type Product,
} from './catalog.service'

export function CatalogPage() {
  const { currentBranchId } = useBranch()
  const { can } = usePermissions()
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mayView = can('catalog.view') || can('catalog.manage')
  const mayManage = can('catalog.manage')

  async function refresh() {
    if (!currentBranchId || !mayView) return
    setLoading(true)
    setError(null)
    try {
      const [nextCategories, nextProducts] = await Promise.all([
        listCategories(currentBranchId),
        listProducts(currentBranchId),
      ])
      setCategories(nextCategories)
      setProducts(nextProducts)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل الكتالوج')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [currentBranchId, mayView])

  if (!mayView) return null

  async function handleCategorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!currentBranchId || !mayManage) return
    const form = new FormData(event.currentTarget)
    await createCategory({
      branchId: currentBranchId,
      code: String(form.get('code') ?? ''),
      nameAr: String(form.get('nameAr') ?? ''),
      nameEn: String(form.get('nameEn') ?? ''),
    })
    event.currentTarget.reset()
    await refresh()
  }

  async function handleProductSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!currentBranchId || !mayManage) return
    const form = new FormData(event.currentTarget)
    await createProduct({
      branchId: currentBranchId,
      categoryId: String(form.get('categoryId') ?? '') || null,
      sku: String(form.get('sku') ?? ''),
      barcode: String(form.get('barcode') ?? ''),
      nameAr: String(form.get('nameAr') ?? ''),
      nameEn: String(form.get('nameEn') ?? ''),
      salePrice: Number(form.get('salePrice') ?? 0),
    })
    event.currentTarget.reset()
    await refresh()
  }

  return (
    <section className="workspace-card catalog-workspace" aria-labelledby="catalog-title">
      <div className="workspace-heading catalog-heading">
        <div>
          <p className="eyebrow">Catalog</p>
          <h2 id="catalog-title">الكتالوج</h2>
          <p>إدارة المنتجات والتصنيفات المستخدمة في البيع ضمن مساحة عمل واحدة واضحة.</p>
        </div>
        <div className="catalog-header-actions">
          <span className="catalog-count">{categories.length} تصنيف</span>
          <span className="catalog-count">{products.length} منتج</span>
          <button type="button" onClick={() => void refresh()} disabled={loading}>تحديث</button>
        </div>
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {loading ? <p className="muted-text">جارٍ تحميل الكتالوج…</p> : null}

      <div className="catalog-layout">
        {mayManage ? (
          <aside className="catalog-create-rail" aria-label="إضافة عناصر للكتالوج">
            <form className="catalog-form" onSubmit={handleCategorySubmit}>
              <h3>إضافة تصنيف</h3>
              <input name="code" placeholder="الكود" required />
              <input name="nameAr" placeholder="الاسم بالعربية" required />
              <input name="nameEn" placeholder="الاسم بالإنجليزية" />
              <button type="submit">حفظ التصنيف</button>
            </form>

            <form className="catalog-form" onSubmit={handleProductSubmit}>
              <h3>إضافة منتج</h3>
              <select name="categoryId" defaultValue="">
                <option value="">بدون تصنيف</option>
                {categories.filter((category) => category.is_active).map((category) => (
                  <option key={category.id} value={category.id}>{category.name_ar}</option>
                ))}
              </select>
              <input name="sku" placeholder="SKU" />
              <input name="barcode" placeholder="Barcode" />
              <input name="nameAr" placeholder="الاسم بالعربية" required />
              <input name="nameEn" placeholder="الاسم بالإنجليزية" />
              <input name="salePrice" type="number" min="0" step="0.01" placeholder="سعر البيع" required />
              <button type="submit">حفظ المنتج</button>
            </form>
          </aside>
        ) : null}

        <div className="catalog-data-area">
          <section className="catalog-panel">
            <div className="catalog-panel-heading"><h3>التصنيفات</h3><span>{categories.length}</span></div>
            {categories.length === 0 ? <p className="muted-text">لا توجد تصنيفات بعد.</p> : (
              <div className="catalog-list" role="list">
                {categories.map((category) => (
                  <div className="catalog-list-row" role="listitem" key={category.id}>
                    <strong>{category.name_ar}</strong>
                    <span>{category.code}</span>
                    <span>{category.is_active ? 'نشط' : 'متوقف'}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="catalog-panel catalog-products-panel">
            <div className="catalog-panel-heading"><h3>المنتجات</h3><span>{products.length}</span></div>
            {products.length === 0 ? <p className="muted-text">لا توجد منتجات بعد.</p> : (
              <div className="catalog-list catalog-product-list" role="list">
                {products.map((product) => (
                  <div className="catalog-list-row" role="listitem" key={product.id}>
                    <strong>{product.name_ar}</strong>
                    <span>{product.sku || '—'}</span>
                    <span>{product.sale_price.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  )
}
