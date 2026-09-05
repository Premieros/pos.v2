import { supabase } from '../../lib/supabase/client'

export type PosOrderType = 'dine_in' | 'take_away' | 'drive_thru' | 'delivery' | 'quick'
export type PosOrderStatus = 'created' | 'held' | 'sent_to_kitchen' | 'preparing' | 'ready' | 'partially_paid' | 'paid' | 'closed' | 'cancelled' | 'voided' | 'returned' | 'merged'

export type PosProduct = {
  id: string
  name_ar: string
  name_en: string | null
  sale_price: number
  category_id: string | null
}

export type PosWarehouse = {
  id: string
  name_ar: string
  is_active: boolean
}

export type DiningTable = {
  id: string
  code: string
  name: string
  floor_name: string | null
  capacity: number
  is_active: boolean
}

export type PosOrder = {
  id: string
  order_number: number
  branch_id: string
  order_type: PosOrderType
  status: PosOrderStatus
  dining_table_id: string | null
  guest_count: number
  subtotal: number
  discount_total: number
  total: number
  notes: string | null
  created_at: string
}

export type PosOrderItem = {
  id: string
  order_id: string
  product_id: string
  product_name: string
  unit_price: number
  quantity: number
  sent_quantity: number
  is_removed: boolean
  line_total: number
  notes: string | null
}

export async function hasOwnOpenShift(branchId: string): Promise<boolean> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const userId = userData.user?.id
  if (!userId) return false

  const { data, error } = await supabase
    .from('shifts')
    .select('id')
    .eq('branch_id', branchId)
    .eq('user_id', userId)
    .eq('status', 'open')
    .limit(1)

  if (error) throw error
  return (data?.length ?? 0) > 0
}

export async function listPosProducts(branchId: string): Promise<PosProduct[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, name_ar, name_en, sale_price, category_id')
    .eq('branch_id', branchId)
    .eq('is_active', true)
    .order('name_ar')
  if (error) throw error
  return (data ?? []) as PosProduct[]
}

export async function listPosWarehouses(branchId: string): Promise<PosWarehouse[]> {
  const { data, error } = await supabase
    .from('warehouses')
    .select('id, name_ar, is_active')
    .eq('branch_id', branchId)
    .eq('is_active', true)
    .order('name_ar')
  if (error) throw error
  return (data ?? []) as PosWarehouse[]
}

export async function countKitchenQueue(branchId: string): Promise<number> {
  const { data, error } = await supabase.rpc('count_kitchen_queue', { p_branch_id: branchId })
  if (error) throw error
  return Number(data ?? 0)
}

export async function listDiningTables(branchId: string): Promise<DiningTable[]> {
  const { data, error } = await supabase
    .from('dining_tables')
    .select('id, code, name, floor_name, capacity, is_active')
    .eq('branch_id', branchId)
    .eq('is_active', true)
    .order('sort_order')
    .order('name')
  if (error) throw error
  return (data ?? []) as DiningTable[]
}

export async function listActiveOrders(branchId: string): Promise<PosOrder[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_number, branch_id, order_type, status, dining_table_id, guest_count, subtotal, discount_total, total, notes, created_at')
    .eq('branch_id', branchId)
    .in('status', ['created', 'held', 'sent_to_kitchen', 'preparing', 'ready', 'partially_paid', 'paid'])
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as PosOrder[]
}

export async function listOrderItems(orderId: string): Promise<PosOrderItem[]> {
  const { data, error } = await supabase
    .from('order_items')
    .select('id, order_id, product_id, product_name, unit_price, quantity, sent_quantity, is_removed, line_total, notes')
    .eq('order_id', orderId)
    .order('created_at')
  if (error) throw error
  return (data ?? []) as PosOrderItem[]
}

export async function createDiningTable(input: { branchId: string; code: string; name: string; capacity: number; floorName?: string }): Promise<string> {
  const { data, error } = await supabase.rpc('create_dining_table', {
    p_branch_id: input.branchId,
    p_code: input.code.trim(),
    p_name: input.name.trim(),
    p_capacity: input.capacity,
    p_floor_name: input.floorName?.trim() || null,
  })
  if (error) throw error
  return data as string
}

export async function createPosOrder(input: { branchId: string; orderType: PosOrderType; diningTableId?: string | null; guestCount?: number; notes?: string }): Promise<string> {
  const { data, error } = await supabase.rpc('create_pos_order', {
    p_branch_id: input.branchId,
    p_order_type: input.orderType,
    p_dining_table_id: input.orderType === 'dine_in' ? input.diningTableId ?? null : null,
    p_guest_count: input.guestCount ?? 1,
    p_notes: input.notes?.trim() || null,
    p_idempotency_key: crypto.randomUUID(),
  })
  if (error) throw error
  return data as string
}

export async function addPosOrderItem(orderId: string, productId: string, quantity = 1): Promise<string> {
  const { data, error } = await supabase.rpc('add_pos_order_item', {
    p_order_id: orderId,
    p_product_id: productId,
    p_quantity: quantity,
    p_notes: null,
  })
  if (error) throw error
  return data as string
}

export async function setPosOrderItemQuantity(orderItemId: string, quantity: number): Promise<void> {
  const { error } = await supabase.rpc('set_pos_order_item_quantity', { p_order_item_id: orderItemId, p_quantity: quantity })
  if (error) throw error
}

export async function removePosOrderItem(orderItemId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_pos_order_item', { p_order_item_id: orderItemId })
  if (error) throw error
}

export async function holdPosOrder(orderId: string): Promise<void> {
  const { error } = await supabase.rpc('hold_pos_order', { p_order_id: orderId })
  if (error) throw error
}

export async function resumePosOrder(orderId: string): Promise<void> {
  const { error } = await supabase.rpc('resume_pos_order', { p_order_id: orderId })
  if (error) throw error
}

export async function cancelPosOrder(orderId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_pos_order', { p_order_id: orderId, p_reason: reason.trim() })
  if (error) throw error
}

export async function voidPosOrder(orderId: string, reason: string): Promise<string> {
  const { data, error } = await supabase.rpc('void_pos_order', {
    p_order_id: orderId,
    p_reason: reason.trim(),
    p_idempotency_key: crypto.randomUUID(),
  })
  if (error) throw error
  return data as string
}

export async function transferOrderTable(orderId: string, toTableId: string, reason: string): Promise<string> {
  const { data, error } = await supabase.rpc('transfer_order_table', {
    p_order_id: orderId,
    p_to_table_id: toTableId,
    p_reason: reason.trim(),
    p_idempotency_key: crypto.randomUUID(),
  })
  if (error) throw error
  return data as string
}

export async function mergeDineInOrders(targetOrderId: string, sourceOrderId: string, reason: string): Promise<string> {
  const { data, error } = await supabase.rpc('merge_dine_in_orders', {
    p_target_order_id: targetOrderId,
    p_source_order_id: sourceOrderId,
    p_reason: reason.trim(),
    p_idempotency_key: crypto.randomUUID(),
  })
  if (error) throw error
  return data as string
}

export async function sendOrderToKitchen(orderId: string, warehouseId: string): Promise<string> {
  const { data, error } = await supabase.rpc('send_order_to_kitchen', {
    p_order_id: orderId,
    p_warehouse_id: warehouseId,
    p_idempotency_key: crypto.randomUUID(),
  })
  if (error) throw error
  return data as string
}
