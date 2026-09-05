import { useEffect, useState } from 'react'
import { useBranch } from '../branches/useBranch'
import { usePermissions } from '../permissions/usePermissions'
import { createSupplier, listSuppliers, updateSupplier, type Supplier } from './supplier.service'
import './suppliers.css'

export function SuppliersPage() {
  const { currentBranchId } = useBranch()
  const { can } = usePermissions()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canView = can('procurement.view') || can('procurement.suppliers.manage')
  const canManage = can('procurement.suppliers.manage')

  async function refresh() {
    if (!currentBranchId || !canView) return
    setLoading(true)
    setError(null)
    try {
      setSuppliers(await listSuppliers(currentBranchId))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل الموردين')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [currentBranchId, canView])

  if (!currentBranchId || !canView) return null
  const branchId = currentBranchId

  async function handleCreate(form: HTMLFormElement) {
    const data = new FormData(form)
    setError(null)
    try {
      await createSupplier(branchId, {
        code: String(data.get('code') ?? ''),
        nameAr: String(data.get('nameAr') ?? ''),
        nameEn: String(data.get('nameEn') ?? ''),
        phone: String(data.get('phone') ?? ''),
        email: String(data.get('email') ?? ''),
        taxNumber: String(data.get('taxNumber') ?? ''),
        notes: String(data.get('notes') ?? ''),
      })
      form.reset()
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر إنشاء المورد')
    }
  }

  async function toggleSupplier(supplier: Supplier) {
    setError(null)
    try {
      await updateSupplier(supplier.id, {
        code: supplier.code,
        nameAr: supplier.name_ar,
        nameEn: supplier.name_en ?? '',
        phone: supplier.phone ?? '',
        email: supplier.email ?? '',
        taxNumber: supplier.tax_number ?? '',
        notes: supplier.notes ?? '',
        isActive: !supplier.is_active,
      })
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحديث المورد')
    }
  }

  return (
    <section className="workspace-card suppliers-workspace" aria-labelledby="suppliers-title">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">Procurement</p>
          <h2 id="suppliers-title">الموردون</h2>
          <p>الموردون معزولون حسب الفرع، والإنشاء والتعديل يتمان عبر أوامر قاعدة البيانات فقط.</p>
        </div>
        <span>{suppliers.filter((supplier) => supplier.is_active).length} مورد نشط</span>
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {loading ? <p>جارٍ تحميل الموردين…</p> : null}

      {canManage ? (
        <form className="supplier-form" onSubmit={(event) => { event.preventDefault(); void handleCreate(event.currentTarget) }}>
          <input name="code" required placeholder="كود المورد" />
          <input name="nameAr" required minLength={2} placeholder="اسم المورد بالعربية" />
          <input name="nameEn" placeholder="الاسم بالإنجليزية" />
          <input name="phone" placeholder="الهاتف" />
          <input name="email" type="email" placeholder="البريد الإلكتروني" />
          <input name="taxNumber" placeholder="الرقم الضريبي" />
          <input name="notes" placeholder="ملاحظات" />
          <button type="submit">إضافة مورد</button>
        </form>
      ) : null}

      <div className="supplier-list">
        {suppliers.map((supplier) => (
          <article key={supplier.id} className="supplier-row">
            <div>
              <strong>{supplier.name_ar}</strong>
              <span>{supplier.code}</span>
            </div>
            <div>
              <span>{supplier.phone || '—'}</span>
              <span>{supplier.tax_number || 'بدون رقم ضريبي'}</span>
            </div>
            <span>{supplier.is_active ? 'نشط' : 'موقوف'}</span>
            {canManage ? <button type="button" onClick={() => void toggleSupplier(supplier)}>{supplier.is_active ? 'إيقاف' : 'تفعيل'}</button> : null}
          </article>
        ))}
        {!loading && !suppliers.length ? <p className="muted-text">لا يوجد موردون في هذا الفرع بعد.</p> : null}
      </div>
    </section>
  )
}
