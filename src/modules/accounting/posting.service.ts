import { supabase } from '../../lib/supabase/client'

export type PostingMapping = {
  branch_id: string
  sales_revenue_account_id: string | null
  sales_cash_account_id: string | null
  sales_card_account_id: string | null
  purchase_inventory_account_id: string | null
  purchase_payable_account_id: string | null
}

export type SourcePosting = {
  id: string
  branch_id: string
  source_type: 'pos_order' | 'purchase_receipt'
  source_id: string
  status: 'pending_configuration' | 'pending_data' | 'posted' | 'error'
  journal_entry_id: string | null
  last_error: string | null
  posted_at: string | null
}

export async function getPostingMapping(branchId: string): Promise<PostingMapping | null> {
  const { data, error } = await supabase.from('accounting_posting_mappings').select('branch_id,sales_revenue_account_id,sales_cash_account_id,sales_card_account_id,purchase_inventory_account_id,purchase_payable_account_id').eq('branch_id', branchId).maybeSingle()
  if (error) throw error
  return data as PostingMapping | null
}

export async function listSourcePostings(branchId: string): Promise<SourcePosting[]> {
  const { data, error } = await supabase.from('accounting_source_postings').select('id,branch_id,source_type,source_id,status,journal_entry_id,last_error,posted_at').eq('branch_id', branchId).order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as SourcePosting[]
}

export async function setPostingMappings(input: { branchId: string; salesRevenue: string; salesCash: string; salesCard: string; purchaseInventory: string; purchasePayable: string }): Promise<void> {
  const { error } = await supabase.rpc('set_accounting_posting_mappings', {
    p_branch_id: input.branchId,
    p_sales_revenue: input.salesRevenue || null,
    p_sales_cash: input.salesCash || null,
    p_sales_card: input.salesCard || null,
    p_purchase_inventory: input.purchaseInventory || null,
    p_purchase_payable: input.purchasePayable || null,
  })
  if (error) throw error
}

export async function retrySourcePosting(postingId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('retry_accounting_source', { p_posting_id: postingId })
  if (error) throw error
  return data as string | null
}
