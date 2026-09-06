import { supabase } from '../../lib/supabase/client'

export type AdminBranch = { id: string; code: string; name_ar: string; name_en: string | null; is_active: boolean }
export type AdminUser = { id: string; display_name: string; is_active: boolean }
export type PlatformUser = AdminUser & { has_branch_access: boolean }
export type AdminRole = { id: string; code: string; name_ar: string; name_en: string | null; is_system: boolean }
export type AdminPermission = { key: string; module: string; description: string }
export type AdminWarehouse = { id: string; code: string; name_ar: string; name_en: string | null; is_active: boolean }
export type RolePermission = { role_id: string; permission_key: string }
export type UserRoleAssignment = { user_id: string; role_id: string }
export type UserPermissionOverride = { user_id: string; permission_key: string; effect: 'grant' | 'revoke' }

export type AdministrationSnapshot = {
  branch: AdminBranch
  can_create_branch: boolean
  users: AdminUser[]
  platform_users: PlatformUser[]
  roles: AdminRole[]
  role_permissions: RolePermission[]
  user_role_assignments: UserRoleAssignment[]
  user_permissions: UserPermissionOverride[]
  permissions: AdminPermission[]
  warehouses: AdminWarehouse[]
}

export async function getAdministrationSnapshot(branchId: string): Promise<AdministrationSnapshot> {
  const { data, error } = await supabase.rpc('get_branch_administration_snapshot', { p_branch_id: branchId })
  if (error) throw error
  return data as AdministrationSnapshot
}

export async function createBranch(input: { code: string; nameAr: string; nameEn?: string }): Promise<string> {
  const { data, error } = await supabase.rpc('create_branch_admin', {
    p_code: input.code,
    p_name_ar: input.nameAr,
    p_name_en: input.nameEn?.trim() || null,
  })
  if (error) throw error
  return data as string
}

export async function updateBranch(input: { branchId: string; nameAr: string; nameEn?: string; isActive: boolean }): Promise<void> {
  const { error } = await supabase.rpc('update_branch_admin', {
    p_branch_id: input.branchId,
    p_name_ar: input.nameAr,
    p_name_en: input.nameEn?.trim() || null,
    p_is_active: input.isActive,
  })
  if (error) throw error
}

export async function createRoleTemplate(input: { branchId: string; code: string; nameAr: string; nameEn?: string; permissionKeys: string[] }): Promise<string> {
  const { data, error } = await supabase.rpc('create_role_template', {
    p_branch_id: input.branchId,
    p_code: input.code,
    p_name_ar: input.nameAr,
    p_name_en: input.nameEn?.trim() || null,
    p_permission_keys: input.permissionKeys,
  })
  if (error) throw error
  return data as string
}

export async function updateRoleTemplate(input: { roleId: string; branchId: string; nameAr: string; nameEn?: string; permissionKeys: string[] }): Promise<void> {
  const { error } = await supabase.rpc('update_role_template', {
    p_role_id: input.roleId,
    p_branch_id: input.branchId,
    p_name_ar: input.nameAr,
    p_name_en: input.nameEn?.trim() || null,
    p_permission_keys: input.permissionKeys,
  })
  if (error) throw error
}

export async function grantUserBranchAccess(userId: string, branchId: string): Promise<void> {
  const { error } = await supabase.rpc('grant_user_branch_access_admin', { p_user_id: userId, p_branch_id: branchId })
  if (error) throw error
}

export async function revokeUserBranchAccess(userId: string, branchId: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_user_branch_access_admin', { p_user_id: userId, p_branch_id: branchId })
  if (error) throw error
}

export async function updateWarehouse(input: { warehouseId: string; branchId: string; nameAr: string; nameEn?: string; isActive: boolean }): Promise<void> {
  const { error } = await supabase
    .from('warehouses')
    .update({ name_ar: input.nameAr.trim(), name_en: input.nameEn?.trim() || null, is_active: input.isActive })
    .eq('id', input.warehouseId)
    .eq('branch_id', input.branchId)
  if (error) throw error
}
