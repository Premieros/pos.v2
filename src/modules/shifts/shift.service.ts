import { supabase } from '../../lib/supabase/client'

export type Shift = {
  id: string
  branch_id: string
  user_id: string
  status: 'open' | 'closed'
  opening_balance: number
  expected_cash: number | null
  actual_cash: number | null
  cash_difference: number | null
  opened_at: string
  closed_at: string | null
  close_note: string | null
}

export async function listShifts(branchId: string): Promise<Shift[]> {
  const { data, error } = await supabase.from('shifts').select('*').eq('branch_id', branchId).order('opened_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Shift[]
}

export async function openShift(branchId: string, openingBalance: number) {
  const { data, error } = await supabase.rpc('open_shift', { p_branch_id: branchId, p_opening_balance: openingBalance })
  if (error) throw error
  return data as string
}

export async function recordCashMovement(input: { shiftId: string; branchId: string; movementType: 'cash_in' | 'cash_out'; amount: number; reason: string }) {
  const { error } = await supabase.rpc('record_cash_drawer_movement', {
    p_shift_id: input.shiftId,
    p_branch_id: input.branchId,
    p_movement_type: input.movementType,
    p_amount: input.amount,
    p_reason: input.reason,
    p_idempotency_key: crypto.randomUUID(),
  })
  if (error) throw error
}

export async function closeShift(input: { shiftId: string; branchId: string; actualCash: number; note?: string; idempotencyKey?: string }) {
  const { data, error } = await supabase.rpc('close_shift_idempotent', {
    p_shift_id: input.shiftId,
    p_branch_id: input.branchId,
    p_actual_cash: input.actualCash,
    p_note: input.note ?? null,
    p_idempotency_key: input.idempotencyKey ?? crypto.randomUUID(),
  })
  if (error) throw error
  return data as Shift
}
