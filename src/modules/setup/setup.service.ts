import { supabase } from '../../lib/supabase/client'

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
