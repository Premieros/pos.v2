import { supabase } from '../../lib/supabase/client'

export type StockCountSession = {
  id: string
  branch_id: string
  warehouse_id: string
  status: 'draft' | 'pending_approval' | 'posted' | 'rejected' | 'cancelled'
  note: string | null
  submitted_at: string | null
  created_at: string
}

export type StockCountLine = {
  id: string
  branch_id: string
  session_id: string
  inventory_item_id: string
  system_quantity: number
  counted_quantity: number
  variance_quantity: number
  observed_at: string
}

export async function listStockCountSessions(branchId: string): Promise<StockCountSession[]> {
  const { data, error } = await supabase
    .from('stock_count_sessions')
    .select('id, branch_id, warehouse_id, status, note, submitted_at, created_at')
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as StockCountSession[]
}

export async function listStockCountLines(sessionId: string): Promise<StockCountLine[]> {
  const { data, error } = await supabase
    .from('stock_count_lines')
    .select('id, branch_id, session_id, inventory_item_id, system_quantity, counted_quantity, variance_quantity, observed_at')
    .eq('session_id', sessionId)
    .order('observed_at')
  if (error) throw error
  return (data ?? []).map((row) => ({
    ...row,
    system_quantity: Number(row.system_quantity),
    counted_quantity: Number(row.counted_quantity),
    variance_quantity: Number(row.variance_quantity),
  })) as StockCountLine[]
}

export async function createStockCountSession(input: { branchId: string; warehouseId: string; note?: string }): Promise<string> {
  const { data, error } = await supabase.rpc('create_stock_count_session', {
    p_branch_id: input.branchId,
    p_warehouse_id: input.warehouseId,
    p_note: input.note?.trim() || null,
  })
  if (error) throw error
  return data as string
}

export async function setStockCountLine(input: { sessionId: string; inventoryItemId: string; countedQuantity: number }): Promise<string> {
  const { data, error } = await supabase.rpc('set_stock_count_line', {
    p_session_id: input.sessionId,
    p_inventory_item_id: input.inventoryItemId,
    p_counted_quantity: input.countedQuantity,
  })
  if (error) throw error
  return data as string
}

export async function submitStockCountSession(sessionId: string): Promise<string> {
  const { data, error } = await supabase.rpc('submit_stock_count_session', { p_session_id: sessionId })
  if (error) throw error
  return data as string
}
