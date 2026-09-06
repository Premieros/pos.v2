import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useBranch } from '../branches/useBranch'
import { usePermissions } from '../permissions/usePermissions'
import {
  createCustomer,
  createCustomerAddress,
  listCustomerAddresses,
  listCustomers,
  updateCustomer,
  type Customer,
  type CustomerAddress,
} from './customer.service'
import './customers.css'

export function CustomersPage() {
  const { currentBranchId } = useBranch()
  const branchId = currentBranchId
  const { can } = usePermissions()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [addresses, setAddresses] = useState<CustomerAddress[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mayView = can('customers.view') || can('customers.create') || can('customers.manage')
  const mayCreate = can('customers.create') || can('customers.manage')
  const mayManage = can('customers.manage')
  const selected = customers.find((customer) => customer.id === selectedId) ?? null
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleCustomers = useMemo(() => customers.filter((customer) => {
    if (!normalizedQuery) return true
    return [customer.name, customer.phone, customer.email].some((value) => (value ?? '').toLocaleLowerCase().includes(normalizedQuery))
  }), [customers, normalizedQuery])

  async function refreshCustomers() {
    if (!branchId || !mayView) return
    setLoading(true)
    setError(null)
    try {
      const next = await listCustomers(branchId, includeInactive)
      setCustomers(next)
      setSelectedId((current) => current && next.some((customer) => customer.id === current) ? current : next[0]?.id ?? null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل العملاء')
    } finally {
      setLoading(false)
    }
  }

  async function refreshAddresses(customerId: string | null) {
    if (!customerId) {
      setAddresses([])
      return
    }
    try {
      setAddresses(await listCustomerAddresses(customerId))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل عناوين العميل')
    }
  }

  useEffect(() => { void refreshCustomers() }, [branchId, mayView, includeInactive])
  useEffect(() => { void refreshAddresses(selectedId) }, [selectedId])

  if (!mayView || !branchId) return null

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!mayCreate) return
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    setError(null)
    try {
      const id = await createCustomer({
        branchId,
        name: String(form.get('name') ?? ''),
        phone: String(form.get('phone') ?? ''),
        email: String(form.get('email') ?? ''),
        notes: String(form.get('notes') ?? ''),
      })
      formElement.reset()
      await refreshCustomers()
      setSelectedId(id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر إنشاء العميل')
    }
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || !mayManage) return
    const form = new FormData(event.currentTarget)
    setError(null)
    try {
      await updateCustomer({
        customerId: selected.id,
        name: String(form.get('name') ?? ''),
        phone: String(form.get('phone') ?? ''),
        email: String(form.get('email') ?? ''),
        notes: String(form.get('notes') ?? ''),
        isActive: form.get('isActive') === 'on',
      })
      await refreshCustomers()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحديث العميل')
    }
  }

  async function handleAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || !mayCreate) return
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    setError(null)
    try {
      await createCustomerAddress({
        customerId: selected.id,
        label: String(form.get('label') ?? ''),
        addressLine: String(form.get('addressLine') ?? ''),
        area: String(form.get('area') ?? ''),
        city: String(form.get('city') ?? ''),
        deliveryNotes: String(form.get('deliveryNotes') ?? ''),
        isDefault: form.get('isDefault') === 'on',
      })
      formElement.reset()
      await refreshAddresses(selected.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر إضافة العنوان')
    }
  }

  return (
    <section className="workspace-card customers-workspace" aria-labelledby="customers-title">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">Customers</p>
          <h2 id="customers-title">العملاء والعناوين</h2>
          <p>دليل عملاء الفرع المستخدم في البيع والدليفري، مع بحث سريع وإدارة العناوين.</p>
        </div>
        <div className="customers-heading-actions">
          <span>{customers.filter((customer) => customer.is_active).length} نشط</span>
          <button type="button" onClick={() => void refreshCustomers()} disabled={loading}>تحديث</button>
        </div>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="customers-toolbar">
        <input aria-label="بحث العملاء" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="اسم / هاتف / بريد" />
        <label className="compact-check"><input type="checkbox" checked={includeInactive} onChange={(event) => setIncludeInactive(event.target.checked)} /> عرض غير النشط</label>
      </div>

      <div className="customers-layout">
        <aside className="customers-list" aria-label="قائمة العملاء">
          {loading ? <p className="muted-text">جارٍ التحميل…</p> : null}
          {visibleCustomers.map((customer) => (
            <button key={customer.id} type="button" className={selectedId === customer.id ? 'selected' : ''} onClick={() => setSelectedId(customer.id)}>
              <strong>{customer.name}</strong>
              <span>{customer.phone || customer.email || 'بدون بيانات اتصال'}</span>
              <small>{customer.is_active ? 'نشط' : 'متوقف'}</small>
            </button>
          ))}
          {!loading && !visibleCustomers.length ? <p className="muted-text">لا توجد نتائج.</p> : null}
        </aside>

        <div className="customers-detail">
          {selected ? (
            <>
              <section className="customers-panel">
                <div className="customers-panel-heading"><h3>بيانات العميل</h3><span>{selected.is_active ? 'نشط' : 'متوقف'}</span></div>
                <form key={selected.id} className="customers-form" onSubmit={handleUpdate}>
                  <input name="name" defaultValue={selected.name} required placeholder="الاسم" disabled={!mayManage} />
                  <input name="phone" defaultValue={selected.phone ?? ''} placeholder="الهاتف" disabled={!mayManage} />
                  <input name="email" type="email" defaultValue={selected.email ?? ''} placeholder="البريد" disabled={!mayManage} />
                  <textarea name="notes" defaultValue={selected.notes ?? ''} placeholder="ملاحظات" disabled={!mayManage} />
                  {mayManage ? <label className="compact-check"><input name="isActive" type="checkbox" defaultChecked={selected.is_active} /> نشط</label> : null}
                  {mayManage ? <button type="submit">حفظ التعديلات</button> : null}
                </form>
              </section>

              <section className="customers-panel">
                <div className="customers-panel-heading"><h3>العناوين</h3><span>{addresses.length}</span></div>
                <div className="customers-addresses">
                  {addresses.map((address) => (
                    <article key={address.id}>
                      <strong>{address.label || 'عنوان'}</strong>
                      <span>{address.address_line}</span>
                      <small>{[address.area, address.city].filter(Boolean).join(' · ') || '—'}{address.is_default ? ' · افتراضي' : ''}</small>
                      {address.delivery_notes ? <small>{address.delivery_notes}</small> : null}
                    </article>
                  ))}
                  {!addresses.length ? <p className="muted-text">لا توجد عناوين مسجلة.</p> : null}
                </div>
                {mayCreate ? (
                  <details>
                    <summary>إضافة عنوان</summary>
                    <form className="customers-form" onSubmit={handleAddress}>
                      <input name="label" placeholder="المنزل / العمل" />
                      <input name="addressLine" required placeholder="العنوان" />
                      <input name="area" placeholder="المنطقة" />
                      <input name="city" placeholder="المدينة" />
                      <input name="deliveryNotes" placeholder="ملاحظات التوصيل" />
                      <label className="compact-check"><input name="isDefault" type="checkbox" /> افتراضي</label>
                      <button type="submit">حفظ العنوان</button>
                    </form>
                  </details>
                ) : null}
              </section>
            </>
          ) : <p className="muted-text">اختر عميلًا لعرض التفاصيل.</p>}
        </div>

        {mayCreate ? (
          <aside className="customers-create customers-panel">
            <h3>عميل جديد</h3>
            <form className="customers-form" onSubmit={handleCreate}>
              <input name="name" required placeholder="الاسم" />
              <input name="phone" placeholder="الهاتف" />
              <input name="email" type="email" placeholder="البريد" />
              <textarea name="notes" placeholder="ملاحظات" />
              <button type="submit">إضافة العميل</button>
            </form>
          </aside>
        ) : null}
      </div>
    </section>
  )
}
