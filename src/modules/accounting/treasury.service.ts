import { supabase } from '../../lib/supabase/client'

export type TreasuryAccount = {
  id: string
  branch_id: string
  code: string
  name_ar: string
  name_en: string | null
  treasury_type: 'cash' | 'bank'
  account_id: string
  bank_name: string | null
  bank_account_reference: string | null
  is_active: boolean
}

export type TreasuryMovement = {
  id: string
  branch_id: string
  treasury_account_id: string
  movement_number: number
  movement_date: string
  direction: 'in' | 'out'
  amount: number
  counter_account_id: string
  description: string
  reference: string | null
  journal_entry_id: string
}

export type TreasuryBalance = { branch_id: string; treasury_account_id: string; balance: number }

export async function listTreasuryAccounts(branchId: string): Promise<TreasuryAccount[]> {
  const { data, error } = await supabase.from('treasury_accounts').select('id,branch_id,code,name_ar,name_en,treasury_type,account_id,bank_name,bank_account_reference,is_active').eq('branch_id', branchId).order('code')
  if (error) throw error
  return (data ?? []) as TreasuryAccount[]
}

export async function listTreasuryMovements(branchId: string): Promise<TreasuryMovement[]> {
  const { data, error } = await supabase.from('treasury_movements').select('id,branch_id,treasury_account_id,movement_number,movement_date,direction,amount,counter_account_id,description,reference,journal_entry_id').eq('branch_id', branchId).order('movement_date', { ascending: false }).order('movement_number', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => ({ ...row, movement_number: Number(row.movement_number), amount: Number(row.amount) })) as TreasuryMovement[]
}

export async function listTreasuryBalances(branchId: string): Promise<TreasuryBalance[]> {
  const { data, error } = await supabase.from('treasury_balances').select('branch_id,treasury_account_id,balance').eq('branch_id', branchId)
  if (error) throw error
  return (data ?? []).map((row) => ({ ...row, balance: Number(row.balance) })) as TreasuryBalance[]
}

export async function createTreasuryAccount(input: { branchId: string; code: string; nameAr: string; nameEn?: string; treasuryType: 'cash'|'bank'; accountId: string; bankName?: string; bankAccountReference?: string }): Promise<string> {
  const { data, error } = await supabase.rpc('create_treasury_account', {
    p_branch_id: input.branchId, p_code: input.code.trim(), p_name_ar: input.nameAr.trim(), p_name_en: input.nameEn?.trim() || null,
    p_treasury_type: input.treasuryType, p_account_id: input.accountId, p_bank_name: input.bankName?.trim() || null, p_bank_account_reference: input.bankAccountReference?.trim() || null,
  })
  if (error) throw error
  return data as string
}

export async function createTreasuryMovement(input: { branchId: string; treasuryAccountId: string; movementDate: string; direction: 'in'|'out'; amount: number; counterAccountId: string; description: string; reference?: string; idempotencyKey: string }): Promise<string> {
  const { data, error } = await supabase.rpc('create_treasury_movement', {
    p_branch_id: input.branchId, p_treasury_account_id: input.treasuryAccountId, p_movement_date: input.movementDate, p_direction: input.direction,
    p_amount: input.amount, p_counter_account_id: input.counterAccountId, p_description: input.description.trim(), p_reference: input.reference?.trim() || null, p_idempotency_key: input.idempotencyKey,
  })
  if (error) throw error
  return data as string
}
