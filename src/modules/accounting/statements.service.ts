import { supabase } from '../../lib/supabase/client'

export type StatementAccount = { id: string; code: string; name_ar: string; name_en: string | null; account_type: string }

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

type TrialBalanceRpcRow = Omit<TrialBalanceRow, 'total_debit' | 'total_credit' | 'balance'> & {
  total_debit: number | string
  total_credit: number | string
  balance: number | string
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

type LedgerRpcRow = Omit<LedgerRow, 'entry_number' | 'debit' | 'credit' | 'running_balance'> & {
  entry_number: number | string
  debit: number | string
  credit: number | string
  running_balance: number | string
}

export type IncomeStatementRow = {
  account_id: string
  code: string
  name_ar: string
  account_type: 'revenue' | 'expense'
  amount: number
}

type IncomeStatementRpcRow = Omit<IncomeStatementRow, 'amount'> & { amount: number | string }

export type BalanceSheetRow = {
  account_id: string | null
  code: string
  name_ar: string
  account_type: 'asset' | 'liability' | 'equity'
  amount: number
  is_synthetic: boolean
}

type BalanceSheetRpcRow = Omit<BalanceSheetRow, 'amount'> & { amount: number | string }

export async function getStatementAccounts(branchId: string): Promise<StatementAccount[]> {
  const { data, error } = await supabase.rpc('get_statement_accounts', { p_branch_id: branchId })
  if (error) throw error
  return (data ?? []) as StatementAccount[]
}

export async function getTrialBalance(branchId: string, fromDate: string, toDate: string): Promise<TrialBalanceRow[]> {
  const { data, error } = await supabase.rpc('get_trial_balance', { p_branch_id: branchId, p_from_date: fromDate, p_to_date: toDate })
  if (error) throw error
  return ((data ?? []) as TrialBalanceRpcRow[]).map((row) => ({ ...row, total_debit: Number(row.total_debit), total_credit: Number(row.total_credit), balance: Number(row.balance) }))
}

export async function getGeneralLedger(branchId: string, accountId: string, fromDate: string, toDate: string): Promise<LedgerRow[]> {
  const { data, error } = await supabase.rpc('get_general_ledger', { p_branch_id: branchId, p_account_id: accountId, p_from_date: fromDate, p_to_date: toDate })
  if (error) throw error
  return ((data ?? []) as LedgerRpcRow[]).map((row) => ({ ...row, entry_number: Number(row.entry_number), debit: Number(row.debit), credit: Number(row.credit), running_balance: Number(row.running_balance) }))
}

export async function getIncomeStatement(branchId: string, fromDate: string, toDate: string): Promise<IncomeStatementRow[]> {
  const { data, error } = await supabase.rpc('get_income_statement', { p_branch_id: branchId, p_from_date: fromDate, p_to_date: toDate })
  if (error) throw error
  return ((data ?? []) as IncomeStatementRpcRow[]).map((row) => ({ ...row, amount: Number(row.amount) }))
}

export async function getBalanceSheet(branchId: string, asOf: string): Promise<BalanceSheetRow[]> {
  const { data, error } = await supabase.rpc('get_balance_sheet', { p_branch_id: branchId, p_as_of: asOf })
  if (error) throw error
  return ((data ?? []) as BalanceSheetRpcRow[]).map((row) => ({ ...row, amount: Number(row.amount) }))
}
