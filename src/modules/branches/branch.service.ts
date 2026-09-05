import { supabase } from '../../lib/supabase/client'

export type AccessibleBranch = {
  id: string
  code: string
  name_ar: string
  name_en: string | null
  is_active: boolean
}

export async function listAccessibleBranches(): Promise<AccessibleBranch[]> {
  const { data, error } = await supabase
    .from('branches')
    .select('id, code, name_ar, name_en, is_active')
    .eq('is_active', true)
    .order('name_ar')

  if (error) throw error
  return data ?? []
}
