import { supabase } from '../../lib/supabase/client'

export type PurchaseOrderStatus = 'draft' | 'submitted' | 'partially_received' | 'received' | 'cancelled'

export type PurchaseOrder = {
  id: string
  branch_id: string
  purchase_number: number
  supplier_id: string
  status: PurchaseOrderStatus
  subtotal: number
  total: number
  notes: string | null
  created_at: string
  updated_at: string
}

export type PurchaseOrderLine = {
  id: string
  branch_id: string
  purchase_order_id: string
  inventory_item_id: string
  ordered_quantity: number
  received_quantity: number
  unit_cost: number
  line_total: number
  created_at: string
  updated_at: string
}

export type PurchaseReceiptLineInput = {
  lineId: string
  quantity: number
}

export async function listPurchaseOrders(branchId: string): Promise<PurchaseOrder[]> {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('id, branch_id, purchase_number, supplier_id, status, subtotal, total, notes, created_at, updated_at')
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => ({
    ...row,
    purchase_number: Number(row.purchase_number),
    subtotal: Number(row.subtotal),
    total: Number(row.total),
  })) as PurchaseOrder[]
}

export async function listPurchaseOrderLines(purchaseOrderId: string): Promise<PurchaseOrderLine[]> {
  const { data, error } = await supabase
    .from('purchase_order_lines')
    .select('id, branch_id, purchase_order_id, inventory_item_id, ordered_quantity, received_quantity, unit_cost, line_total, created_at, updated_at')
    .eq('purchase_order_id', purchaseOrderId)
    .order('created_at')

  if (error) throw error
  return (data ?? []).map((row) => ({
    ...row,
    ordered_quantity: Number(row.ordered_quantity),
    received_quantity: Number(row.received_quantity),
    unit_cost: Number(row.unit_cost),
    line_total: Number(row.line_total),
  })) as PurchaseOrderLine[]
}

export async function createPurchaseOrder(input: {
  branchId: string
  supplierId: string
  notes?: string
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_purchase_order', {
    p_branch_id: input.branchId,
    p_supplier_id: input.supplierId,
    p_notes: input.notes?.trim() || null,
    p_idempotency_key: crypto.randomUUID(),
  })

  if (error) throw error
  return data as string
}

export async function addPurchaseOrderLine(input: {
  purchaseOrderId: string
  inventoryItemId: string
  quantity: number
  unitCost: number
}): Promise<string> {
  const { data, error } = await supabase.rpc('add_purchase_order_line', {
    p_purchase_order_id: input.purchaseOrderId,
    p_inventory_item_id: input.inventoryItemId,
    p_quantity: input.quantity,
    p_unit_cost: input.unitCost,
  })

  if (error) throw error
  return data as string
}

export async function updatePurchaseOrderLine(input: {
  lineId: string
  quantity: number
  unitCost: number
}): Promise<void> {
  const { error } = await supabase.rpc('update_purchase_order_line', {
    p_line_id: input.lineId,
    p_quantity: input.quantity,
    p_unit_cost: input.unitCost,
  })
  if (error) throw error
}

export async function removePurchaseOrderLine(lineId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_purchase_order_line', { p_line_id: lineId })
  if (error) throw error
}

export async function receivePurchaseOrder(input: {
  purchaseOrderId: string
  warehouseId: string
  lines: PurchaseReceiptLineInput[]
  note?: string
}): Promise<string> {
  const { data, error } = await supabase.rpc('receive_purchase_order', {
    p_purchase_order_id: input.purchaseOrderId,
    p_warehouse_id: input.warehouseId,
    p_lines: input.lines.map((line) => ({ line_id: line.lineId, quantity: line.quantity })),
    p_idempotency_key: crypto.randomUUID(),
    p_note: input.note?.trim() || null,
  })
  if (error) throw error
  return data as string
}
