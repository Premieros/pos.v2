import { useEffect, useMemo, useState } from 'react'
import { useBranch } from '../branches/useBranch'
import { createWarehouse } from '../inventory/inventory.service'
import { usePermissions } from '../permissions/usePermissions'
import { assignUserRole, clearUserPermissionOverride, createUser, setUserPermission, unassignUserRole } from '../users/user.service'
import {
  createBranch,
  createRoleTemplate,
  getAdministrationSnapshot,
  grantUserBranchAccess,
  revokeUserBranchAccess,
  updateBranch,
  updateRoleTemplate,
  updateWarehouse,
  type AdministrationSnapshot,
} from './admin.service'
import './admin.css'

type Tab = 'branch' | 'users' | 'roles' | 'warehouses'

export function AdminPage() {
  const { currentBranchId, refreshBranches } = useBranch()
  const { can } = usePermissions()
  const [tab, setTab] = useState<Tab>('branch')
  const [snapshot, setSnapshot] = useState<AdministrationSnapshot | null>(null)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canOpen = can('settings.manage') || can('branches.view') || can('branches.manage') || can('branches.update') || can('users.view') || can('users.manage') || can('users.permissions.manage') || can('roles.view') || can('roles.manage') || can('roles.assign') || can('inventory.setup')
  const canUsers = can('users.view') || can('users.manage') || can('users.permissions.manage') || can('roles.assign')
  const canCreateUser = can('users.create') || can('users.manage')
  const canManageUsers = can('users.manage')
  const canManagePermissions = can('users.permissions.manage')
  const canAssignRoles = can('roles.assign')
  const canManageRoles = can('roles.manage')
  const canManageBranch = can('branches.update') || can('branches.manage')
  const canManageWarehouse = can('inventory.setup')

  async function refresh() {
    if (!currentBranchId || !canOpen) return
    setError(null)
    try {
      const next = await getAdministrationSnapshot(currentBranchId)
      setSnapshot(next)
      setSelectedUserId((value) => next.users.some((user) => user.id === value) ? value : next.users[0]?.id ?? '')
      setSelectedRoleId((value) => next.roles.some((role) => role.id === value) ? value : next.roles[0]?.id ?? '')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل مركز الإدارة')
    }
  }

  useEffect(() => { void refresh() }, [currentBranchId, canOpen])

  const selectedUser = snapshot?.users.find((user) => user.id === selectedUserId) ?? null
  const selectedRole = snapshot?.roles.find((role) => role.id === selectedRoleId) ?? null
  const selectedUserRoles = useMemo(() => new Set((snapshot?.user_role_assignments ?? []).filter((item) => item.user_id === selectedUserId).map((item) => item.role_id)), [snapshot, selectedUserId])
  const selectedUserOverrides = useMemo(() => new Map((snapshot?.user_permissions ?? []).filter((item) => item.user_id === selectedUserId).map((item) => [item.permission_key, item.effect])), [snapshot, selectedUserId])
  const selectedRolePermissions = useMemo(() => new Set((snapshot?.role_permissions ?? []).filter((item) => item.role_id === selectedRoleId).map((item) => item.permission_key)), [snapshot, selectedRoleId])

  if (!currentBranchId || !canOpen) return null
  const branchId = currentBranchId

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try { await action(); await refresh() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر تنفيذ العملية') }
    finally { setBusy(false) }
  }

  return (
    <section className="workspace-card admin-workspace" aria-labelledby="admin-title">
      <div className="workspace-heading"><div><p className="eyebrow">ADMINISTRATION</p><h2 id="admin-title">الإدارة والإعدادات</h2><p>إدارة الفرع والمخازن والمستخدمين والأدوار والصلاحيات بعقد Permission-First. حساب Super Admin المحمي غير معروض ولا يمكن استهدافه.</p></div></div>
      {error ? <p className="error-text">{error}</p> : null}
      {!snapshot ? <p>جارٍ تحميل بيانات الإدارة…</p> : (
        <>
          <div className="admin-tabs">
            <button type="button" className={tab === 'branch' ? 'active' : ''} onClick={() => setTab('branch')}>الفرع</button>
            {canUsers ? <button type="button" className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>المستخدمون</button> : null}
            {(can('roles.view') || canManageRoles || canAssignRoles) ? <button type="button" className={tab === 'roles' ? 'active' : ''} onClick={() => setTab('roles')}>الأدوار والصلاحيات</button> : null}
            {(can('inventory.view') || canManageWarehouse) ? <button type="button" className={tab === 'warehouses' ? 'active' : ''} onClick={() => setTab('warehouses')}>المخازن</button> : null}
          </div>

          {tab === 'branch' ? <div className="admin-grid">
            <article className="admin-panel"><h3>بيانات الفرع الحالي</h3><form className="admin-form" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); void run(async () => { await updateBranch({ branchId, nameAr: String(data.get('nameAr') ?? ''), nameEn: String(data.get('nameEn') ?? ''), isActive: data.get('isActive') === 'on' }); await refreshBranches() }) }}>
              <label>الكود<input value={snapshot.branch.code} disabled /></label>
              <label>الاسم العربي<input name="nameAr" defaultValue={snapshot.branch.name_ar} disabled={!canManageBranch} required /></label>
              <label>الاسم الإنجليزي<input name="nameEn" defaultValue={snapshot.branch.name_en ?? ''} disabled={!canManageBranch} /></label>
              <label className="admin-check"><input name="isActive" type="checkbox" defaultChecked={snapshot.branch.is_active} disabled={!canManageBranch} />فرع نشط</label>
              {canManageBranch ? <button type="submit" disabled={busy}>حفظ الفرع</button> : null}
            </form></article>
            {snapshot.can_create_branch ? <article className="admin-panel"><h3>إنشاء فرع جديد</h3><form className="admin-form" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); void run(async () => { await createBranch({ code: String(data.get('code') ?? ''), nameAr: String(data.get('nameAr') ?? ''), nameEn: String(data.get('nameEn') ?? '') }); form.reset(); await refreshBranches() }) }}>
              <input name="code" required placeholder="كود الفرع" /><input name="nameAr" required placeholder="الاسم العربي" /><input name="nameEn" placeholder="الاسم الإنجليزي" /><button type="submit" disabled={busy}>إنشاء الفرع</button>
            </form></article> : null}
          </div> : null}

          {tab === 'warehouses' ? <div className="admin-grid">
            {canManageWarehouse ? <article className="admin-panel"><h3>مخزن جديد</h3><form className="admin-form" onSubmit={(event) => { event.preventDefault(); const form=event.currentTarget; const data=new FormData(form); void run(async()=>{ await createWarehouse({ branchId, code:String(data.get('code')??''), nameAr:String(data.get('nameAr')??''), nameEn:String(data.get('nameEn')??'') }); form.reset() }) }}><input name="code" required placeholder="الكود"/><input name="nameAr" required placeholder="الاسم العربي"/><input name="nameEn" placeholder="الاسم الإنجليزي"/><button type="submit" disabled={busy}>إضافة مخزن</button></form></article> : null}
            <article className="admin-panel admin-wide"><h3>المخازن</h3><div className="admin-list">{snapshot.warehouses.map((warehouse) => <form key={warehouse.id} className="admin-row" onSubmit={(event)=>{event.preventDefault(); const data=new FormData(event.currentTarget); void run(()=>updateWarehouse({ warehouseId:warehouse.id, branchId, nameAr:String(data.get('nameAr')??''), nameEn:String(data.get('nameEn')??''), isActive:data.get('isActive')==='on' }))}}><strong>{warehouse.code}</strong><input name="nameAr" defaultValue={warehouse.name_ar} disabled={!canManageWarehouse}/><input name="nameEn" defaultValue={warehouse.name_en??''} disabled={!canManageWarehouse}/><label className="admin-check"><input name="isActive" type="checkbox" defaultChecked={warehouse.is_active} disabled={!canManageWarehouse}/>نشط</label>{canManageWarehouse?<button type="submit" disabled={busy}>حفظ</button>:null}</form>)}</div></article>
          </div> : null}

          {tab === 'users' && canUsers ? <div className="admin-grid">
            {canCreateUser ? <article className="admin-panel"><h3>مستخدم جديد</h3><form className="admin-form" onSubmit={(event)=>{event.preventDefault(); const form=event.currentTarget; const data=new FormData(form); void run(async()=>{ await createUser({ email:String(data.get('email')??''), password:String(data.get('password')??''), displayName:String(data.get('displayName')??''), branchId }); form.reset() })}}><input name="displayName" required placeholder="اسم المستخدم"/><input name="email" type="email" required placeholder="البريد الإلكتروني"/><input name="password" type="password" minLength={8} required placeholder="كلمة المرور"/><button type="submit" disabled={busy}>إنشاء المستخدم</button></form></article> : null}
            <article className="admin-panel"><h3>مستخدمو الفرع</h3><select value={selectedUserId} onChange={(event)=>setSelectedUserId(event.target.value)}><option value="">اختر مستخدمًا</option>{snapshot.users.map((user)=><option key={user.id} value={user.id}>{user.display_name}{user.is_active?'':' — غير نشط'}</option>)}</select>{selectedUser && canManageUsers ? <button type="button" className="danger-button" disabled={busy} onClick={()=>void run(()=>revokeUserBranchAccess(selectedUser.id, branchId))}>سحب الوصول لهذا الفرع</button>:null}</article>
            {snapshot.can_create_branch && canManageUsers ? <article className="admin-panel"><h3>إضافة مستخدم موجود للفرع</h3><div className="admin-list">{snapshot.platform_users.filter((user)=>!user.has_branch_access).map((user)=><div className="admin-row compact" key={user.id}><span>{user.display_name}</span><button type="button" disabled={busy} onClick={()=>void run(()=>grantUserBranchAccess(user.id, branchId))}>منح الوصول</button></div>)}</div></article>:null}
            {selectedUser ? <article className="admin-panel admin-wide"><h3>صلاحيات {selectedUser.display_name}</h3>
              {canAssignRoles ? <div className="admin-permission-groups"><h4>قوالب الأدوار</h4>{snapshot.roles.map((role)=><label className="admin-check" key={role.id}><input type="checkbox" checked={selectedUserRoles.has(role.id)} onChange={(event)=>void run(()=>event.target.checked?assignUserRole({userId:selectedUser.id,branchId,roleId:role.id}):unassignUserRole({userId:selectedUser.id,branchId,roleId:role.id}))}/>{role.name_ar} <small>{role.code}</small></label>)}</div>:null}
              {canManagePermissions ? <div className="admin-permission-groups"><h4>الاستثناءات المباشرة</h4>{snapshot.permissions.map((permission)=>{const effect=selectedUserOverrides.get(permission.key)??'inherit'; return <div className="permission-row" key={permission.key}><div><strong>{permission.key}</strong><small>{permission.description}</small></div><select value={effect} disabled={busy} onChange={(event)=>{const next=event.target.value as 'inherit'|'grant'|'revoke'; void run(()=>next==='inherit'?clearUserPermissionOverride({userId:selectedUser.id,branchId,permissionKey:permission.key}):setUserPermission({userId:selectedUser.id,branchId,permissionKey:permission.key,effect:next}))}}><option value="inherit">من الدور/الافتراضي</option><option value="grant">منح مباشر</option><option value="revoke">سحب صريح</option></select></div>})}</div>:null}
            </article>:null}
          </div> : null}

          {tab === 'roles' ? <div className="admin-grid">
            {canManageRoles ? <article className="admin-panel"><h3>قالب دور جديد</h3><RoleForm permissions={snapshot.permissions} busy={busy} onSubmit={(input)=>run(()=>createRoleTemplate({ branchId, ...input }).then(()=>undefined))}/></article>:null}
            <article className="admin-panel"><h3>الأدوار المتاحة</h3><select value={selectedRoleId} onChange={(event)=>setSelectedRoleId(event.target.value)}><option value="">اختر دورًا</option>{snapshot.roles.map((role)=><option key={role.id} value={role.id}>{role.name_ar} — {role.code}</option>)}</select></article>
            {selectedRole ? <article className="admin-panel admin-wide"><h3>قالب {selectedRole.name_ar}</h3>{canManageRoles && !selectedRole.is_system ? <RoleForm key={selectedRole.id} permissions={snapshot.permissions} busy={busy} initial={{ nameAr:selectedRole.name_ar, nameEn:selectedRole.name_en??'', permissionKeys:[...selectedRolePermissions] }} hideCode onSubmit={(input)=>run(()=>updateRoleTemplate({ roleId:selectedRole.id, branchId, nameAr:input.nameAr, nameEn:input.nameEn, permissionKeys:input.permissionKeys }))}/>:<div className="admin-permission-groups">{snapshot.permissions.filter((permission)=>selectedRolePermissions.has(permission.key)).map((permission)=><span key={permission.key}>{permission.key}</span>)}</div>}</article>:null}
          </div> : null}
        </>
      )}
    </section>
  )
}

type RoleFormInput = { code: string; nameAr: string; nameEn: string; permissionKeys: string[] }
function RoleForm({ permissions, busy, hideCode = false, initial, onSubmit }: { permissions: AdministrationSnapshot['permissions']; busy:boolean; hideCode?:boolean; initial?:Partial<RoleFormInput>; onSubmit:(input:RoleFormInput)=>Promise<void> }) {
  const [selected, setSelected] = useState<string[]>(initial?.permissionKeys ?? [])
  const modules = useMemo(()=>[...new Set(permissions.map((permission)=>permission.module))], [permissions])
  return <form className="admin-form" onSubmit={(event)=>{event.preventDefault(); const form=event.currentTarget; const data=new FormData(form); void onSubmit({ code:String(data.get('code')??initial?.code??''), nameAr:String(data.get('nameAr')??''), nameEn:String(data.get('nameEn')??''), permissionKeys:selected }).then(()=>{if(!hideCode){form.reset();setSelected([])}})}}>{!hideCode?<input name="code" required placeholder="كود الدور" defaultValue={initial?.code??''}/>:null}<input name="nameAr" required placeholder="اسم الدور بالعربية" defaultValue={initial?.nameAr??''}/><input name="nameEn" placeholder="اسم الدور بالإنجليزية" defaultValue={initial?.nameEn??''}/><div className="role-permission-editor">{modules.map((module)=><fieldset key={module}><legend>{module}</legend>{permissions.filter((permission)=>permission.module===module).map((permission)=><label className="admin-check" key={permission.key}><input type="checkbox" checked={selected.includes(permission.key)} onChange={(event)=>setSelected((current)=>event.target.checked?[...current,permission.key]:current.filter((key)=>key!==permission.key))}/><span><strong>{permission.key}</strong><small>{permission.description}</small></span></label>)}</fieldset>)}</div><button type="submit" disabled={busy}>حفظ القالب</button></form>
}
