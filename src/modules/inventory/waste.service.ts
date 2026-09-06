import { supabase } from '../../lib/supabase/client'

export type WasteDocument = {
  id: string
  branch_id: string
  warehouse_id: string
  status: 'draft' | 'posted' | 'cancelled'
  reason: string
  note: string | null
  posted_at: string | null
  created_at: string
}

export type WasteDocumentLine = {
  id: string
  branch_id: string
  waste_document_id: string
  inventory_item_id: string
  quantity: number
  note: string | null
  stock_movement_id: string | null
}

export async function listWasteDocuments(branchId: string): Promise<WasteDocument[]> {
  const { data, error } = await supabase
    .from('waste_documents')
    .select('id, branch_id, warehouse_id, status, reason, note, posted_at, created_at')
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as WasteDocument[]
}

export async function listWasteDocumentLines(documentId: string): Promise<WasteDocumentLine[]> {
  const { data, error } = await supabase
    .from('waste_document_lines')
    .select('id, branch_id, waste_document_id, inventory_item_id, quantity, note, stock_movement_id')
    .eq('waste_document_id', documentId)
    .order('created_at')
  if (error) throw error
  return (data ?? []).map((row) => ({ ...row, quantity: Number(row.quantity) })) as WasteDocumentLine[]
}

export async function createWasteDocument(input: { branchId: string; warehouseId: string; reason: string; note?: string }): Promise<string> {
  const { data, error } = await supabase.rpc('create_waste_document', {
    p_branch_id: input.branchId,
    p_warehouse_id: input.warehouseId,
    p_reason: input.reason.trim(),
    p_note: input.note?.trim() || null,
  })
  if (error) throw error
  return data as string
}

export async function addWasteDocumentLine(input: { documentId: string; inventoryItemId: string; quantity: number; note?: string }): Promise<string> {
  const { data, error } = await supabase.rpc('add_waste_document_line', {
    p_document_id: input.documentId,
    p_inventory_item_id: input.inventoryItemId,
    p_quantity: input.quantity,
    p_note: input.note?.trim() || null,
  })
  if (error) throw error
  return data as string
}

export async function postWasteDocument(documentId: string): Promise<string> {
  const { data, error } = await supabase.rpc('post_waste_document', { p_document_id: documentId })
  if (error) throw error
  return data as string
}
