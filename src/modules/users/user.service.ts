import { supabase } from '../../lib/supabase/client'

export type BranchUser = {
  userId: string
  displayName: string
  isActive: boolean
}

export async function listBranchUsers(branchId: string): Promise<BranchUser[]> {
  const { data, error } = await supabase.rpc('list_branch_users', {
    p_branch_id: branchId,
  })
  if (error) throw error
  return (data ?? []).map((row: { user_id: string; display_name: string; is_active: boolean }) => ({
    userId: row.user_id,
    displayName: row.display_name,
    isActive: row.is_active,
  }))
}

export async function createUser(input: {
  email: string
  password: string
  displayName: string
  branchId: string
}): Promise<string> {
  const { data, error } = await supabase.functions.invoke('create-user', {
    body: input,
  })
  if (error) throw error
  if (!data?.userId) throw new Error('User creation did not return a user id')
  return data.userId as string
}

export async function setUserPermission(input: {
  userId: string
  branchId: string
  permissionKey: string
  effect: 'grant' | 'revoke'
}): Promise<void> {
  const { error } = await supabase.rpc('set_user_permission', {
    p_user_id: input.userId,
    p_branch_id: input.branchId,
    p_permission_key: input.permissionKey,
    p_effect: input.effect,
  })
  if (error) throw error
}

export async function clearUserPermissionOverride(input: {
  userId: string
  branchId: string
  permissionKey: string
}): Promise<void> {
  const { error } = await supabase.rpc('clear_user_permission_override', {
    p_user_id: input.userId,
    p_branch_id: input.branchId,
    p_permission_key: input.permissionKey,
  })
  if (error) throw error
}

export async function assignUserRole(input: {
  userId: string
  branchId: string
  roleId: string
}): Promise<void> {
  const { error } = await supabase.rpc('assign_user_role', {
    p_user_id: input.userId,
    p_branch_id: input.branchId,
    p_role_id: input.roleId,
  })
  if (error) throw error
}

export async function unassignUserRole(input: {
  userId: string
  branchId: string
  roleId: string
}): Promise<void> {
  const { error } = await supabase.rpc('unassign_user_role', {
    p_user_id: input.userId,
    p_branch_id: input.branchId,
    p_role_id: input.roleId,
  })
  if (error) throw error
}
