import { supabase } from '../../lib/supabase/client'

export type ModifierGroup = {
  id: string
  branch_id: string
  code: string
  name_ar: string
  name_en: string | null
  min_select: number
  max_select: number
  sort_order: number
  is_active: boolean
}

export type ModifierOption = {
  id: string
  branch_id: string
  group_id: string
  code: string
  name_ar: string
  name_en: string | null
  price_delta: number
  inventory_item_id: string | null
  inventory_quantity: number
  sort_order: number
  is_active: boolean
}

export type ProductModifierGroup = {
  branch_id: string
  product_id: string
  group_id: string
  sort_order: number
}

export type OrderItemModifier = {
  id: string
  branch_id: string
  order_item_id: string
  modifier_group_id: string
  modifier_option_id: string
  option_name_snapshot: string
  price_delta_snapshot: number
  inventory_quantity_snapshot: number
  quantity: number
}

export type ProductModifierConfig = {
  group: ModifierGroup
  options: ModifierOption[]
}

export type ModifierInventoryItem = {
  id: string
  code: string
  name_ar: string
  base_unit: string
  is_active: boolean
}

export async function getProductModifierConfig(branchId: string, productId: string): Promise<ProductModifierConfig[]> {
  const { data: links, error: linkError } = await supabase
    .from('product_modifier_groups')
    .select('branch_id, product_id, group_id, sort_order')
    .eq('branch_id', branchId)
    .eq('product_id', productId)
    .order('sort_order')
  if (linkError) throw linkError
  const typedLinks = (links ?? []) as ProductModifierGroup[]
  if (!typedLinks.length) return []

  const groupIds = typedLinks.map((link) => link.group_id)
  const [{ data: groups, error: groupError }, { data: options, error: optionError }] = await Promise.all([
    supabase
      .from('modifier_groups')
      .select('id, branch_id, code, name_ar, name_en, min_select, max_select, sort_order, is_active')
      .eq('branch_id', branchId)
      .in('id', groupIds)
      .eq('is_active', true),
    supabase
      .from('modifier_options')
      .select('id, branch_id, group_id, code, name_ar, name_en, price_delta, inventory_item_id, inventory_quantity, sort_order, is_active')
      .eq('branch_id', branchId)
      .in('group_id', groupIds)
      .eq('is_active', true)
      .order('sort_order'),
  ])
  if (groupError) throw groupError
  if (optionError) throw optionError

  const groupMap = new Map(((groups ?? []) as ModifierGroup[]).map((group) => [group.id, group]))
  const typedOptions = (options ?? []) as ModifierOption[]
  return typedLinks
    .map((link) => {
      const group = groupMap.get(link.group_id)
      if (!group) return null
      return { group, options: typedOptions.filter((option) => option.group_id === group.id) }
    })
    .filter((value): value is ProductModifierConfig => value !== null)
}

export async function listModifierGroups(branchId: string): Promise<ModifierGroup[]> {
  const { data, error } = await supabase
    .from('modifier_groups')
    .select('id, branch_id, code, name_ar, name_en, min_select, max_select, sort_order, is_active')
    .eq('branch_id', branchId)
    .order('sort_order')
    .order('name_ar')
  if (error) throw error
  return (data ?? []) as ModifierGroup[]
}

export async function listModifierOptions(branchId: string): Promise<ModifierOption[]> {
  const { data, error } = await supabase
    .from('modifier_options')
    .select('id, branch_id, group_id, code, name_ar, name_en, price_delta, inventory_item_id, inventory_quantity, sort_order, is_active')
    .eq('branch_id', branchId)
    .order('sort_order')
    .order('name_ar')
  if (error) throw error
  return (data ?? []).map((row) => ({
    ...row,
    price_delta: Number(row.price_delta),
    inventory_quantity: Number(row.inventory_quantity),
  })) as ModifierOption[]
}

export async function listModifierInventoryItems(branchId: string): Promise<ModifierInventoryItem[]> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('id, code, name_ar, base_unit, is_active')
    .eq('branch_id', branchId)
    .eq('is_active', true)
    .order('name_ar')
  if (error) throw error
  return (data ?? []) as ModifierInventoryItem[]
}

export async function listProductModifierGroupIds(branchId: string, productId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('product_modifier_groups')
    .select('group_id')
    .eq('branch_id', branchId)
    .eq('product_id', productId)
    .order('sort_order')
  if (error) throw error
  return (data ?? []).map((row) => row.group_id as string)
}

export async function createModifierGroup(input: {
  branchId: string
  code: string
  nameAr: string
  nameEn?: string
  minSelect: number
  maxSelect: number
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_modifier_group', {
    p_branch_id: input.branchId,
    p_code: input.code.trim(),
    p_name_ar: input.nameAr.trim(),
    p_name_en: input.nameEn?.trim() || null,
    p_min_select: input.minSelect,
    p_max_select: input.maxSelect,
  })
  if (error) throw error
  return data as string
}

export async function createModifierOption(input: {
  groupId: string
  code: string
  nameAr: string
  nameEn?: string
  priceDelta: number
  inventoryItemId?: string | null
  inventoryQuantity: number
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_modifier_option', {
    p_group_id: input.groupId,
    p_code: input.code.trim(),
    p_name_ar: input.nameAr.trim(),
    p_name_en: input.nameEn?.trim() || null,
    p_price_delta: input.priceDelta,
    p_inventory_item_id: input.inventoryItemId || null,
    p_inventory_quantity: input.inventoryQuantity,
  })
  if (error) throw error
  return data as string
}

export async function setProductModifierGroups(productId: string, groupIds: string[]): Promise<void> {
  const { error } = await supabase.rpc('set_product_modifier_groups', {
    p_product_id: productId,
    p_group_ids: groupIds,
  })
  if (error) throw error
}

export async function listOrderItemModifiers(orderItemId: string): Promise<OrderItemModifier[]> {
  const { data, error } = await supabase
    .from('order_item_modifiers')
    .select('id, branch_id, order_item_id, modifier_group_id, modifier_option_id, option_name_snapshot, price_delta_snapshot, inventory_quantity_snapshot, quantity')
    .eq('order_item_id', orderItemId)
    .order('created_at')
  if (error) throw error
  return (data ?? []) as OrderItemModifier[]
}

export async function setOrderItemModifiers(orderItemId: string, selections: Array<{ optionId: string; quantity?: number }>): Promise<void> {
  const { error } = await supabase.rpc('set_order_item_modifiers', {
    p_order_item_id: orderItemId,
    p_selections: selections.map((selection) => ({ option_id: selection.optionId, quantity: selection.quantity ?? 1 })),
  })
  if (error) throw error
}
