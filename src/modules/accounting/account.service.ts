import { supabase } from '../../lib/supabase/client'

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'

export type Account = {
  id: string
  branch_id: string
  code: string
  name_ar: string
  name_en: string | null
  account_type: AccountType
  normal_balance: 'debit' | 'credit'
  parent_id: string | null
  is_postable: boolean
  is_active: boolean
  description: string | null
}

export async function listAccounts(branchId: string): Promise<Account[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('id, branch_id, code, name_ar, name_en, account_type, normal_balance, parent_id, is_postable, is_active, description')
    .eq('branch_id', branchId)
    .order('code')
  if (error) throw error
  return (data ?? []) as Account[]
}

export async function createAccount(input: {
  branchId: string
  code: string
  nameAr: string
  nameEn?: string
  accountType: AccountType
  parentId?: string | null
  isPostable: boolean
  description?: string
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_account', {
    p_branch_id: input.branchId,
    p_code: input.code.trim(),
    p_name_ar: input.nameAr.trim(),
    p_name_en: input.nameEn?.trim() || null,
    p_account_type: input.accountType,
    p_parent_id: input.parentId || null,
    p_is_postable: input.isPostable,
    p_description: input.description?.trim() || null,
  })
  if (error) throw error
  return data as string
}

export async function updateAccount(input: {
  accountId: string
  code: string
  nameAr: string
  nameEn?: string | null
  parentId?: string | null
  isPostable: boolean
  isActive: boolean
  description?: string | null
}): Promise<void> {
  const { error } = await supabase.rpc('update_account', {
    p_account_id: input.accountId,
    p_code: input.code.trim(),
    p_name_ar: input.nameAr.trim(),
    p_name_en: input.nameEn?.trim() || null,
    p_parent_id: input.parentId || null,
    p_is_postable: input.isPostable,
    p_is_active: input.isActive,
    p_description: input.description?.trim() || null,
  })
  if (error) throw error
}
