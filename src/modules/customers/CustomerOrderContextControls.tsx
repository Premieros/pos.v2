import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useBranch } from '../branches/useBranch'
import { usePermissions } from '../permissions/usePermissions'
import type { PosOrder } from '../pos/pos.service'
import {
  createCustomer,
  createCustomerAddress,
  getPosOrderCustomerContext,
  listCustomerAddresses,
  listCustomers,
  setPosOrderCustomerContext,
  type Customer,
  type CustomerAddress,
  type OrderCustomerContext,
} from './customer.service'

type Props = {
  order: Pick<PosOrder, 'id' | 'order_type' | 'status'>
  canEdit: boolean
  onChanged?: () => Promise<void> | void
}

const emptyContext: OrderCustomerContext = {
  customer_id: null,
  customer_name_snapshot: null,
  customer_phone_snapshot: null,
  delivery_address_id: null,
  delivery_address_snapshot: null,
  delivery_notes_snapshot: null,
  drive_thru_reference: null,
}

export function CustomerOrderContextControls({ order, canEdit, onChanged }: Props) {
  const { currentBranchId } = useBranch()
  const { can } = usePermissions()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [addresses, setAddresses] = useState<CustomerAddress[]>([])
  const [context, setContext] = useState<OrderCustomerContext>(emptyContext)
  const [customerId, setCustomerId] = useState('')
  const [addressId, setAddressId] = useState('')
  const [driveRef, setDriveRef] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mayCreateCustomer = can('customers.create') || can('customers.manage')

  const selectedCustomer = useMemo(() => customers.find((customer) => customer.id === customerId) ?? null, [customers, customerId])
  const editableOrder = ['created', 'held', 'sent_to_kitchen', 'preparing'].includes(order.status)
  const isDelivery = order.order_type === 'delivery'
  const isDriveThru = order.order_type === 'drive_thru'
  const complete = isDelivery
    ? Boolean(context.customer_id && context.delivery_address_id)
    : isDriveThru
      ? Boolean(context.drive_thru_reference?.trim())
      : true

  async function refreshContext() {
    if (!currentBranchId) return
    setLoading(true)
    setError(null)
    try {
      const [nextCustomers, nextContext] = await Promise.all([
        listCustomers(currentBranchId),
        getPosOrderCustomerContext(order.id),
      ])
      setCustomers(nextCustomers)
      setContext(nextContext)
      setCustomerId(nextContext.customer_id ?? '')
      setAddressId(nextContext.delivery_address_id ?? '')
      setDriveRef(nextContext.drive_thru_reference ?? '')
      if (nextContext.customer_id) setAddresses(await listCustomerAddresses(nextContext.customer_id))
      else setAddresses([])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل بيانات العميل')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refreshContext() }, [order.id, currentBranchId])

  async function chooseCustomer(nextCustomerId: string) {
    setCustomerId(nextCustomerId)
    setAddressId('')
    if (!nextCustomerId) {
      setAddresses([])
      return
    }
    try {
      const next = await listCustomerAddresses(nextCustomerId)
      setAddresses(next)
      const preferred = next.find((address) => address.is_default) ?? next[0]
      if (isDelivery && preferred) setAddressId(preferred.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل عناوين العميل')
    }
  }

  async function saveContext() {
    setError(null)
    try {
      await setPosOrderCustomerContext({
        orderId: order.id,
        customerId: customerId || null,
        deliveryAddressId: isDelivery ? addressId || null : null,
        driveThruReference: isDriveThru ? driveRef : null,
      })
      await refreshContext()
      await onChanged?.()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر حفظ بيانات تنفيذ الطلب')
    }
  }

  async function handleCreateCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!currentBranchId) return
    const form = new FormData(event.currentTarget)
    setError(null)
    try {
      const id = await createCustomer({
        branchId: currentBranchId,
        name: String(form.get('name') ?? ''),
        phone: String(form.get('phone') ?? ''),
      })
      event.currentTarget.reset()
      const nextCustomers = await listCustomers(currentBranchId)
      setCustomers(nextCustomers)
      await chooseCustomer(id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر إنشاء العميل')
    }
  }

  async function handleCreateAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!customerId) return
    const form = new FormData(event.currentTarget)
    setError(null)
    try {
      const id = await createCustomerAddress({
        customerId,
        label: String(form.get('label') ?? ''),
        addressLine: String(form.get('addressLine') ?? ''),
        area: String(form.get('area') ?? ''),
        city: String(form.get('city') ?? ''),
        deliveryNotes: String(form.get('deliveryNotes') ?? ''),
        isDefault: Boolean(form.get('isDefault')),
      })
      event.currentTarget.reset()
      setAddresses(await listCustomerAddresses(customerId))
      setAddressId(id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر إضافة العنوان')
    }
  }

  return (
    <section className="pos-customer-context" aria-label="بيانات العميل وتنفيذ الطلب">
      <div className="pos-customer-context-heading">
        <div>
          <strong>{isDelivery ? 'بيانات الدليفري' : isDriveThru ? 'بيانات الدرايف ثرو' : 'العميل'}</strong>
          <small>{context.customer_name_snapshot ? `${context.customer_name_snapshot}${context.customer_phone_snapshot ? ` · ${context.customer_phone_snapshot}` : ''}` : 'لم يتم اختيار عميل'}</small>
        </div>
        {(isDelivery || isDriveThru) ? <span className={complete ? 'context-complete' : 'context-required'}>{complete ? 'مكتمل' : 'مطلوب قبل المطبخ'}</span> : null}
      </div>

      {loading ? <p className="muted-text">جارٍ تحميل بيانات العميل…</p> : null}
      {error ? <p className="error-text">{error}</p> : null}

      {canEdit && editableOrder ? (
        <div className="pos-customer-context-form">
          <label>
            <span>العميل</span>
            <select value={customerId} onChange={(event) => void chooseCustomer(event.target.value)}>
              <option value="">بدون عميل</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ''}</option>)}
            </select>
          </label>

          {isDelivery ? (
            <label>
              <span>عنوان التوصيل</span>
              <select value={addressId} onChange={(event) => setAddressId(event.target.value)} disabled={!customerId}>
                <option value="">اختر العنوان</option>
                {addresses.map((address) => <option key={address.id} value={address.id}>{address.label || 'عنوان'} · {address.address_line}{address.area ? ` · ${address.area}` : ''}</option>)}
              </select>
            </label>
          ) : null}

          {isDriveThru ? (
            <label>
              <span>رقم السيارة / المرجع</span>
              <input value={driveRef} onChange={(event) => setDriveRef(event.target.value)} placeholder="مثال: ABC-123" />
            </label>
          ) : null}

          <button type="button" onClick={() => void saveContext()}>حفظ بيانات الطلب</button>
        </div>
      ) : null}

      {isDelivery && context.delivery_address_snapshot ? <p className="pos-context-snapshot"><strong>العنوان:</strong> {context.delivery_address_snapshot}{context.delivery_notes_snapshot ? ` — ${context.delivery_notes_snapshot}` : ''}</p> : null}
      {isDriveThru && context.drive_thru_reference ? <p className="pos-context-snapshot"><strong>المرجع:</strong> {context.drive_thru_reference}</p> : null}

      {mayCreateCustomer && canEdit && editableOrder ? (
        <div className="pos-customer-create-tools">
          <details>
            <summary>عميل جديد</summary>
            <form onSubmit={(event) => void handleCreateCustomer(event)}>
              <input name="name" required placeholder="اسم العميل" />
              <input name="phone" placeholder="رقم الهاتف" />
              <button type="submit">إضافة العميل</button>
            </form>
          </details>

          {customerId ? (
            <details>
              <summary>عنوان جديد</summary>
              <form onSubmit={(event) => void handleCreateAddress(event)}>
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
        </div>
      ) : null}
    </section>
  )
}
