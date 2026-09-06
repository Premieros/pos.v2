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
