import { supabase } from '../../lib/supabase/client'
import type { StockCountLine, StockCountSession } from '../inventory/count.service'

export type ApprovalRequest = {
  id: string
  branch_id: string
  request_type: 'stock_count_variance'
  stock_count_session_id: string
  status: 'pending' | 'approved' | 'rejected'
  requested_by: string
  requested_at: string
  reviewed_by: string | null
  reviewed_at: string | null
  review_reason: string | null
}

export async function listApprovalRequests(branchId: string): Promise<ApprovalRequest[]> {
  const { data, error } = await supabase
    .from('approval_requests')
    .select('id, branch_id, request_type, stock_count_session_id, status, requested_by, requested_at, reviewed_by, reviewed_at, review_reason')
    .eq('branch_id', branchId)
    .order('requested_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ApprovalRequest[]
}

export async function getApprovalStockCount(sessionId: string): Promise<{ session: StockCountSession | null; lines: StockCountLine[] }> {
  const [{ data: sessionData, error: sessionError }, { data: linesData, error: linesError }] = await Promise.all([
    supabase.from('stock_count_sessions').select('id, branch_id, warehouse_id, status, note, submitted_at, created_at').eq('id', sessionId).maybeSingle(),
    supabase.from('stock_count_lines').select('id, branch_id, session_id, inventory_item_id, system_quantity, counted_quantity, variance_quantity, observed_at').eq('session_id', sessionId).order('observed_at'),
  ])
  if (sessionError) throw sessionError
  if (linesError) throw linesError
  return {
    session: sessionData as StockCountSession | null,
    lines: (linesData ?? []).map((row) => ({
      ...row,
      system_quantity: Number(row.system_quantity),
      counted_quantity: Number(row.counted_quantity),
      variance_quantity: Number(row.variance_quantity),
    })) as StockCountLine[],
  }
}

export async function reviewStockCountApproval(input: { requestId: string; decision: 'approve' | 'reject'; reason?: string }): Promise<string> {
  const { data, error } = await supabase.rpc('review_stock_count_approval', {
    p_request_id: input.requestId,
    p_decision: input.decision,
    p_reason: input.reason?.trim() || null,
  })
  if (error) throw error
  return data as string
}
