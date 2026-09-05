import { supabase } from '../../lib/supabase/client'

export async function can(permissionKey: string, branchId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('current_user_can', {
    p_permission_key: permissionKey,
    p_branch_id: branchId,
  })

  if (error) throw error
  return data === true
}

export async function getEffectivePermissions(branchId: string): Promise<Set<string>> {
  const { data, error } = await supabase.rpc('current_user_effective_permissions', {
    p_branch_id: branchId,
  })

  if (error) throw error
  return new Set((data ?? []).map((row: { permission_key: string }) => row.permission_key))
}
