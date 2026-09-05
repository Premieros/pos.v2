import { existsSync, readFileSync } from 'node:fs'

function read(path) {
  if (!existsSync(path)) throw new Error(`Missing required file: ${path}`)
  return readFileSync(path, 'utf8')
}

function requireText(path, snippets) {
  const text = read(path)
  for (const snippet of snippets) {
    if (!text.includes(snippet)) throw new Error(`${path} is missing Batch 9 contract marker: ${snippet}`)
  }
}

for (const [path, snippets] of [
  ['supabase/migrations/20260905201332_administration_workspace_contract.sql', ['get_branch_administration_snapshot', 'create_role_template', 'grant_user_branch_access_admin']],
  ['supabase/migrations/20260905201828_harden_administration_public_wrappers.sql', ['security invoker', 'app_private']],
  ['supabase/migrations/20260905202048_guided_initial_setup_state.sql', ['get_initial_setup_state', 'bootstrap_available']],
  ['supabase/migrations/20260905202507_idempotent_shift_close_for_offline_queue.sql', ['close_shift_idempotent', 'shift_close_command_log', 'p_idempotency_key']],
]) requireText(path, snippets)

requireText('docs/DATABASE_IDENTITY_LOCK.md', ['scpovyrqmsbiduanykod'])
requireText('.github/workflows/verify.yml', ['https://scpovyrqmsbiduanykod.supabase.co'])
requireText('src/app/App.tsx', ['GuidedSetupBanner', 'setCurrentBranchId', 'app-shell'])
requireText('src/modules/setup/GuidedSetupBanner.tsx', ['hasOwnOpenShift', 'listPosWarehouses', 'listPosProducts'])
requireText('src/modules/setup/InitialSetupPage.tsx', ['bootstrap_available', 'لا يوجد فرع متاح لهذا الحساب'])
requireText('src/modules/shifts/offlineShiftClose.ts', ['localStorage', 'idempotencyKey', 'syncPendingShiftCloses'])
requireText('src/modules/shifts/shift.service.ts', ['close_shift_idempotent', 'p_idempotency_key'])
requireText('src/styles/shell.css', ['sidebar-collapsed', 'sidebar-open', 'inset-inline-start'])
requireText('src/styles/final-ui.css', ['backdrop-filter', 'prefers-reduced-motion', 'state-panel'])
requireText('src/components/StatePanel.tsx', ['state-panel', 'unauthorized', 'loading'])
requireText('src/main.tsx', ["./styles/shell.css", "./styles/final-ui.css"])

const guardedSources = [
  'src/app/App.tsx',
  'src/modules/admin/AdminPage.tsx',
  'src/modules/admin/admin.service.ts',
  'src/modules/setup/GuidedSetupBanner.tsx',
  'src/modules/setup/InitialSetupPage.tsx',
  'src/modules/shifts/ShiftsPage.tsx',
  'src/modules/shifts/offlineShiftClose.ts',
  'src/modules/shifts/shift.service.ts',
].map(read).join('\n')

if (/role\s*===|role_name\s*===|\.role\s*===/.test(guardedSources)) {
  throw new Error('Role-label authorization detected in Batch 9 feature code')
}

for (const marker of [
  ".from('platform_role_assignments')",
  ".from('shifts').update",
  ".from('user_branch_access').insert",
  ".from('user_permissions').insert",
]) {
  if (guardedSources.includes(marker)) throw new Error(`Direct protected write reintroduced in Batch 9: ${marker}`)
}

const offline = read('src/modules/shifts/offlineShiftClose.ts')
if (!offline.includes('idempotencyKey') || !offline.includes('syncPendingShiftCloses')) {
  throw new Error('Offline shift close must preserve the idempotency retry contract')
}

const shell = read('src/styles/shell.css')
if (!shell.includes('inset-inline-start') || !shell.includes('sidebar-open')) {
  throw new Error('Direction-aware responsive sidebar contract is missing')
}

console.log('Batch 9 repository contract regression guard: PASS')
