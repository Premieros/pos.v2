import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

function read(path) {
  if (!existsSync(path)) throw new Error(`Missing release-candidate file: ${path}`)
  return readFileSync(path, 'utf8')
}

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const stat = statSync(path)
    if (stat.isDirectory()) out.push(...walk(path))
    else out.push(path.replaceAll('\\', '/'))
  }
  return out
}

const lockedRef = 'scpovyrqmsbiduanykod'
const identity = read('docs/DATABASE_IDENTITY_LOCK.md')
const workflow = read('.github/workflows/verify.yml')
const envExample = read('.env.example')

if (!identity.includes(lockedRef)) throw new Error('Database identity lock lost the production project ref')
if (!workflow.includes(`https://${lockedRef}.supabase.co`)) throw new Error('Verify workflow does not point to the locked Supabase project')
if (!envExample.includes('VITE_SUPABASE_URL') || !envExample.includes('VITE_SUPABASE_PUBLISHABLE_KEY')) throw new Error('Public environment contract is incomplete')

for (const path of [
  'scripts/verify-batch5.mjs',
  'scripts/verify-batch6.mjs',
  'scripts/verify-batch7.mjs',
  'scripts/verify-batch8.mjs',
  'scripts/verify-batch9.mjs',
  'scripts/verify-batch10.mjs',
  'scripts/verify-batch11.mjs',
  'scripts/verify-batch12.mjs',
  'playwright.config.mjs',
  'e2e/authenticated-pos.spec.mjs',
  '.github/workflows/e2e.yml',
  'supabase/migrations/20260905201332_administration_workspace_contract.sql',
  'supabase/migrations/20260905201828_harden_administration_public_wrappers.sql',
  'supabase/migrations/20260905202048_guided_initial_setup_state.sql',
  'supabase/migrations/20260905202507_idempotent_shift_close_for_offline_queue.sql',
  'supabase/migrations/20260906095717_product_media_storage_bucket.sql',
]) read(path)

const packageJson = JSON.parse(read('package.json'))
for (const script of ['test:batch5', 'test:batch6', 'test:batch7', 'test:batch8', 'test:batch9', 'test:batch10', 'test:batch11', 'test:batch12', 'test:e2e']) {
  if (!packageJson.scripts?.[script]) throw new Error(`Missing regression script: ${script}`)
}

const sourceFiles = walk('src').filter((path) => /\.(ts|tsx)$/.test(path))
const source = sourceFiles.map((path) => `\n/* ${path} */\n${read(path)}`).join('\n')

if (/\bpos\.sell\b/.test(source)) throw new Error('Broad legacy pos.sell authorization was reintroduced')
if (/role\s*===\s*['"]|role_name\s*===\s*['"]|\.role\s*===\s*['"]/.test(source)) {
  throw new Error('Role-label authorization detected in application source')
}
if (/service[_-]?role/i.test(source)) throw new Error('Service-role marker detected in frontend application source')
if (/SUPABASE_SERVICE/i.test(source)) throw new Error('Service-role environment marker detected in frontend source')

const client = read('src/lib/supabase/client.ts')
if (!client.includes('VITE_SUPABASE_URL') || !client.includes('VITE_SUPABASE_PUBLISHABLE_KEY')) {
  throw new Error('Supabase frontend client is not restricted to public environment variables')
}

const app = read('src/app/App.tsx')
for (const marker of ['GuidedSetupBanner', 'PrintingCenterPage', 'AdminPage', 'ReportsPage', 'ShiftsPage']) {
  if (!app.includes(marker)) throw new Error(`App shell lost required module integration: ${marker}`)
}

console.log(`Release candidate repository guard: PASS (${sourceFiles.length} TS/TSX files scanned)`)
