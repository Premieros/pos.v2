import { supabase } from '../../lib/supabase/client'

export type Customer = {
  id: string
  branch_id: string
  name: string
  phone: string | null
  email: string | null
  notes: string | null
  is_active: boolean
}

export type CustomerAddress = {
  id: string
  branch_id: string
  customer_id: string
  label: string | null
  address_line: string
  area: string | null
  city: string | null
  delivery_notes: string | null
  is_default: boolean
  is_active: boolean
}

export type OrderCustomerContext = {
  customer_id: string | null
  customer_name_snapshot: string | null
  customer_phone_snapshot: string | null
  delivery_address_id: string | null
  delivery_address_snapshot: string | null
  delivery_notes_snapshot: string | null
  drive_thru_reference: string | null
}

export async function listCustomers(branchId: string, includeInactive = false): Promise<Customer[]> {
  let query = supabase
    .from('customers')
    .select('id, branch_id, name, phone, email, notes, is_active')
    .eq('branch_id', branchId)
    .order('name')
  if (!includeInactive) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Customer[]
}

export async function listCustomerAddresses(customerId: string): Promise<CustomerAddress[]> {
  const { data, error } = await supabase
    .from('customer_addresses')
    .select('id, branch_id, customer_id, label, address_line, area, city, delivery_notes, is_default, is_active')
    .eq('customer_id', customerId)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('created_at')
  if (error) throw error
  return (data ?? []) as CustomerAddress[]
}

export async function getPosOrderCustomerContext(orderId: string): Promise<OrderCustomerContext> {
  const { data, error } = await supabase
    .from('orders')
    .select('customer_id, customer_name_snapshot, customer_phone_snapshot, delivery_address_id, delivery_address_snapshot, delivery_notes_snapshot, drive_thru_reference')
    .eq('id', orderId)
    .single()
  if (error) throw error
  return data as OrderCustomerContext
}

export async function createCustomer(input: { branchId: string; name: string; phone?: string; email?: string; notes?: string }): Promise<string> {
  const { data, error } = await supabase.rpc('create_customer', {
    p_branch_id: input.branchId,
    p_name: input.name.trim(),
    p_phone: input.phone?.trim() || null,
    p_email: input.email?.trim() || null,
    p_notes: input.notes?.trim() || null,
  })
  if (error) throw error
  return data as string
}

export async function updateCustomer(input: {
  customerId: string
  name: string
  phone?: string
  email?: string
  notes?: string
  isActive: boolean
}): Promise<void> {
  const { error } = await supabase.rpc('update_customer', {
    p_customer_id: input.customerId,
    p_name: input.name.trim(),
    p_phone: input.phone?.trim() || null,
    p_email: input.email?.trim() || null,
    p_notes: input.notes?.trim() || null,
    p_is_active: input.isActive,
  })
  if (error) throw error
}

export async function createCustomerAddress(input: {
  customerId: string
  label?: string
  addressLine: string
  area?: string
  city?: string
  deliveryNotes?: string
  isDefault?: boolean
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_customer_address', {
    p_customer_id: input.customerId,
    p_label: input.label?.trim() || null,
    p_address_line: input.addressLine.trim(),
    p_area: input.area?.trim() || null,
    p_city: input.city?.trim() || null,
    p_delivery_notes: input.deliveryNotes?.trim() || null,
    p_is_default: input.isDefault ?? false,
  })
  if (error) throw error
  return data as string
}

export async function setPosOrderCustomerContext(input: {
  orderId: string
  customerId?: string | null
  deliveryAddressId?: string | null
  driveThruReference?: string | null
}): Promise<void> {
  const { error } = await supabase.rpc('set_pos_order_customer_context', {
    p_order_id: input.orderId,
    p_customer_id: input.customerId ?? null,
    p_delivery_address_id: input.deliveryAddressId ?? null,
    p_drive_thru_reference: input.driveThruReference?.trim() || null,
  })
  if (error) throw error
}
