import { supabase } from '../../lib/supabase/client'

export type TrialBalanceRow = {
  account_id: string
  code: string
  name_ar: string
  name_en: string
  account_type: string
  total_debit: number
  total_credit: number
  balance: number
}

export type LedgerRow = {
  entry_date: string
  entry_number: number
  journal_entry_id: string
  memo: string | null
  reference: string | null
  debit: number
  credit: number
  running_balance: number
}

export type IncomeStatementRow = {
  account_id: string
  code: string
  name_ar: string
  account_type: 'revenue' | 'expense'
  amount: number
}

export type BalanceSheetRow = {
  account_id: string | null
  code: string
  name_ar: string
  account_type: 'asset' | 'liability' | 'equity'
  amount: number
  is_synthetic: boolean
}

export async function getTrialBalance(branchId: string, fromDate: string, toDate: string): Promise<TrialBalanceRow[]> {
  const { data, error } = await supabase.rpc('get_trial_balance', { p_branch_id: branchId, p_from_date: fromDate, p_to_date: toDate })
  if (error) throw error
  return (data ?? []).map((row) => ({ ...row, total_debit: Number(row.total_debit), total_credit: Number(row.total_credit), balance: Number(row.balance) })) as TrialBalanceRow[]
}

export async function getGeneralLedger(branchId: string, accountId: string, fromDate: string, toDate: string): Promise<LedgerRow[]> {
  const { data, error } = await supabase.rpc('get_general_ledger', { p_branch_id: branchId, p_account_id: accountId, p_from_date: fromDate, p_to_date: toDate })
  if (error) throw error
  return (data ?? []).map((row) => ({ ...row, entry_number: Number(row.entry_number), debit: Number(row.debit), credit: Number(row.credit), running_balance: Number(row.running_balance) })) as LedgerRow[]
}

export async function getIncomeStatement(branchId: string, fromDate: string, toDate: string): Promise<IncomeStatementRow[]> {
  const { data, error } = await supabase.rpc('get_income_statement', { p_branch_id: branchId, p_from_date: fromDate, p_to_date: toDate })
  if (error) throw error
  return (data ?? []).map((row) => ({ ...row, amount: Number(row.amount) })) as IncomeStatementRow[]
}

export async function getBalanceSheet(branchId: string, asOf: string): Promise<BalanceSheetRow[]> {
  const { data, error } = await supabase.rpc('get_balance_sheet', { p_branch_id: branchId, p_as_of: asOf })
  if (error) throw error
  return (data ?? []).map((row) => ({ ...row, amount: Number(row.amount) })) as BalanceSheetRow[]
}
