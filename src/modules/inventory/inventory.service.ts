import { supabase } from '../../lib/supabase/client'

export type Warehouse = {
  id: string
  branch_id: string
  code: string
  name_ar: string
  name_en: string | null
  is_active: boolean
}

export type InventoryItem = {
  id: string
  branch_id: string
  code: string
  name_ar: string
  name_en: string | null
  base_unit: string
  minimum_level: number
  is_active: boolean
}

export type InventoryBalance = {
  branch_id: string
  warehouse_id: string
  inventory_item_id: string
  quantity: number
}

export type InventoryProduct = {
  id: string
  name_ar: string
  inventory_item_id: string | null
  is_active: boolean
}

export type ProductComponent = {
  branch_id: string
  product_id: string
  inventory_item_id: string
  quantity: number
}

export type StockMovementType = 'opening' | 'receipt' | 'adjustment' | 'waste' | 'count_adjustment' | 'return_in' | 'return_out'

export async function listWarehouses(branchId: string): Promise<Warehouse[]> {
  const { data, error } = await supabase
    .from('warehouses')
    .select('id, branch_id, code, name_ar, name_en, is_active')
    .eq('branch_id', branchId)
    .order('name_ar')
  if (error) throw error
  return data ?? []
}

export async function listInventoryItems(branchId: string): Promise<InventoryItem[]> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('id, branch_id, code, name_ar, name_en, base_unit, minimum_level, is_active')
    .eq('branch_id', branchId)
    .order('name_ar')
  if (error) throw error
  return (data ?? []).map((row) => ({ ...row, minimum_level: Number(row.minimum_level) }))
}

export async function listInventoryBalances(branchId: string): Promise<InventoryBalance[]> {
  const { data, error } = await supabase
    .from('inventory_balances')
    .select('branch_id, warehouse_id, inventory_item_id, quantity')
    .eq('branch_id', branchId)
  if (error) throw error
  return (data ?? []).map((row) => ({ ...row, quantity: Number(row.quantity) }))
}

export async function listInventoryProducts(branchId: string): Promise<InventoryProduct[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, name_ar, inventory_item_id, is_active')
    .eq('branch_id', branchId)
    .order('name_ar')
  if (error) throw error
  return (data ?? []) as InventoryProduct[]
}

export async function listProductComponents(branchId: string): Promise<ProductComponent[]> {
  const { data, error } = await supabase
    .from('product_components')
    .select('branch_id, product_id, inventory_item_id, quantity')
    .eq('branch_id', branchId)
  if (error) throw error
  return (data ?? []).map((row) => ({ ...row, quantity: Number(row.quantity) }))
}

export async function createWarehouse(input: { branchId: string; code: string; nameAr: string; nameEn?: string }) {
  const { data, error } = await supabase
    .from('warehouses')
    .insert({
      branch_id: input.branchId,
      code: input.code.trim().toLowerCase(),
      name_ar: input.nameAr.trim(),
      name_en: input.nameEn?.trim() || null,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function createInventoryItem(input: {
  branchId: string
  code: string
  nameAr: string
  nameEn?: string
  baseUnit: string
  minimumLevel?: number
}) {
  const { data, error } = await supabase
    .from('inventory_items')
    .insert({
      branch_id: input.branchId,
      code: input.code.trim().toLowerCase(),
      name_ar: input.nameAr.trim(),
      name_en: input.nameEn?.trim() || null,
      base_unit: input.baseUnit.trim(),
      minimum_level: input.minimumLevel ?? 0,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function setProductInventoryItem(productId: string, inventoryItemId: string | null): Promise<void> {
  const { error } = await supabase.rpc('set_product_inventory_item', {
    p_product_id: productId,
    p_inventory_item_id: inventoryItemId,
  })
  if (error) throw error
}

export async function addProductComponent(input: { branchId: string; productId: string; inventoryItemId: string; quantity: number }): Promise<void> {
  const { error } = await supabase.from('product_components').insert({
    branch_id: input.branchId,
    product_id: input.productId,
    inventory_item_id: input.inventoryItemId,
    quantity: input.quantity,
  })
  if (error) throw error
}

export async function removeProductComponent(input: { branchId: string; productId: string; inventoryItemId: string }): Promise<void> {
  const { error } = await supabase
    .from('product_components')
    .delete()
    .eq('branch_id', input.branchId)
    .eq('product_id', input.productId)
    .eq('inventory_item_id', input.inventoryItemId)
  if (error) throw error
}

export async function recordStockMovement(input: {
  branchId: string
  warehouseId: string
  inventoryItemId: string
  movementType: StockMovementType
  quantityDelta: number
  idempotencyKey: string
  note?: string
}) {
  const { data, error } = await supabase.rpc('record_stock_movement', {
    p_branch_id: input.branchId,
    p_warehouse_id: input.warehouseId,
    p_inventory_item_id: input.inventoryItemId,
    p_movement_type: input.movementType,
    p_quantity_delta: input.quantityDelta,
    p_idempotency_key: input.idempotencyKey,
    p_note: input.note ?? null,
  })
  if (error) throw error
  return data as string
}

export async function transferStock(input: {
  branchId: string
  fromWarehouseId: string
  toWarehouseId: string
  inventoryItemId: string
  quantity: number
  idempotencyKey: string
  note?: string
}) {
  const { data, error } = await supabase.rpc('transfer_stock', {
    p_branch_id: input.branchId,
    p_from_warehouse_id: input.fromWarehouseId,
    p_to_warehouse_id: input.toWarehouseId,
    p_inventory_item_id: input.inventoryItemId,
    p_quantity: input.quantity,
    p_idempotency_key: input.idempotencyKey,
    p_note: input.note ?? null,
  })
  if (error) throw error
  return data as string
}
