import { supabase } from '../../lib/supabase/client'

export type JournalEntry = {
  id: string
  branch_id: string
  entry_number: number
  entry_date: string
  status: 'draft' | 'posted' | 'reversed'
  memo: string | null
  reference: string | null
  posted_at: string | null
  source_type?: string | null
  source_id?: string | null
}

export type JournalLine = {
  id: string
  branch_id: string
  journal_entry_id: string
  line_no: number
  account_id: string
  debit: number
  credit: number
  description: string | null
}

export async function listJournalEntries(branchId: string): Promise<JournalEntry[]> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id, branch_id, entry_number, entry_date, status, memo, reference, posted_at, source_type, source_id')
    .eq('branch_id', branchId)
    .order('entry_date', { ascending: false })
    .order('entry_number', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => ({ ...row, entry_number: Number(row.entry_number) })) as JournalEntry[]
}

export async function listJournalLines(entryId: string): Promise<JournalLine[]> {
  const { data, error } = await supabase
    .from('journal_lines')
    .select('id, branch_id, journal_entry_id, line_no, account_id, debit, credit, description')
    .eq('journal_entry_id', entryId)
    .order('line_no')
  if (error) throw error
  return (data ?? []).map((row) => ({ ...row, line_no: Number(row.line_no), debit: Number(row.debit), credit: Number(row.credit) })) as JournalLine[]
}

export async function createJournalEntry(input: { branchId: string; entryDate: string; memo?: string; reference?: string; idempotencyKey: string }): Promise<string> {
  const { data, error } = await supabase.rpc('create_journal_entry', {
    p_branch_id: input.branchId,
    p_entry_date: input.entryDate,
    p_memo: input.memo?.trim() || null,
    p_reference: input.reference?.trim() || null,
    p_idempotency_key: input.idempotencyKey,
  })
  if (error) throw error
  return data as string
}

export async function addJournalLine(input: { entryId: string; accountId: string; debit: number; credit: number; description?: string }): Promise<string> {
  const { data, error } = await supabase.rpc('add_journal_line', {
    p_journal_entry_id: input.entryId,
    p_account_id: input.accountId,
    p_debit: input.debit,
    p_credit: input.credit,
    p_description: input.description?.trim() || null,
  })
  if (error) throw error
  return data as string
}

export async function removeJournalLine(lineId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_journal_line', { p_journal_line_id: lineId })
  if (error) throw error
}

export async function postJournalEntry(entryId: string): Promise<string> {
  const { data, error } = await supabase.rpc('post_journal_entry', { p_journal_entry_id: entryId })
  if (error) throw error
  return data as string
}

export async function reverseJournalEntry(entryId: string, reason: string): Promise<string> {
  const { data, error } = await supabase.rpc('reverse_journal_entry', {
    p_journal_entry_id: entryId,
    p_reason: reason.trim(),
  })
  if (error) throw error
  return data as string
}
