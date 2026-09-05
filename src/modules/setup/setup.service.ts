import { supabase } from '../../lib/supabase/client'

export type InitialSetupState = {
  branch_count: number
  platform_assignment_count: number
  bootstrap_available: boolean
}

export async function getInitialSetupState(): Promise<InitialSetupState> {
  const { data, error } = await supabase.rpc('get_initial_setup_state')
  if (error) throw error
  return data as InitialSetupState
}

export async function bootstrapFirstSuperAdmin(input: {
  branchCode: string
  branchNameAr: string
  branchNameEn?: string
}): Promise<void> {
  const { error } = await supabase.rpc('bootstrap_first_super_admin', {
    p_branch_code: input.branchCode.trim(),
    p_branch_name_ar: input.branchNameAr.trim(),
    p_branch_name_en: input.branchNameEn?.trim() || null,
  })
  if (error) throw error
}
