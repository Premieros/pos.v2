import { supabase } from '../../lib/supabase/client'

export type ExpenseDocument = {
  id: string
  branch_id: string
  expense_number: number
  expense_date: string
  status: 'draft' | 'posted' | 'reversed'
  amount: number
  expense_account_id: string
  offset_account_id: string
  payee: string | null
  description: string
  reference: string | null
  journal_entry_id: string | null
  posted_at: string | null
}

export async function listExpenseDocuments(branchId: string): Promise<ExpenseDocument[]> {
  const { data, error } = await supabase
    .from('expense_documents')
    .select('id, branch_id, expense_number, expense_date, status, amount, expense_account_id, offset_account_id, payee, description, reference, journal_entry_id, posted_at')
    .eq('branch_id', branchId)
    .order('expense_date', { ascending: false })
    .order('expense_number', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => ({ ...row, expense_number: Number(row.expense_number), amount: Number(row.amount) })) as ExpenseDocument[]
}

export async function createExpenseDocument(input: {
  branchId: string
  expenseDate: string
  amount: number
  expenseAccountId: string
  offsetAccountId: string
  payee?: string
  description: string
  reference?: string
  idempotencyKey: string
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_expense_document', {
    p_branch_id: input.branchId,
    p_expense_date: input.expenseDate,
    p_amount: input.amount,
    p_expense_account_id: input.expenseAccountId,
    p_offset_account_id: input.offsetAccountId,
    p_payee: input.payee?.trim() || null,
    p_description: input.description.trim(),
    p_reference: input.reference?.trim() || null,
    p_idempotency_key: input.idempotencyKey,
  })
  if (error) throw error
  return data as string
}

export async function postExpenseDocument(expenseId: string): Promise<string> {
  const { data, error } = await supabase.rpc('post_expense_document', { p_expense_id: expenseId })
  if (error) throw error
  return data as string
}
