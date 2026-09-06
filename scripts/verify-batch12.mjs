import { existsSync, readFileSync } from 'node:fs'

function read(path) {
  if (!existsSync(path)) throw new Error(`Missing Batch 12 file: ${path}`)
  return readFileSync(path, 'utf8')
}

function requireMarkers(source, markers, label) {
  for (const marker of markers) {
    if (!source.includes(marker)) throw new Error(`${label} lost required marker: ${marker}`)
  }
}

const config = read('playwright.config.mjs')
requireMarkers(config, ["@playwright/test", 'E2E_BASE_URL', "browserName: 'chromium'", "trace: 'retain-on-failure'"], 'Playwright config')

const spec = read('e2e/authenticated-pos.spec.mjs')
requireMarkers(spec, [
  'E2E_CASHIER_EMAIL',
  'E2E_CASHIER_PASSWORD',
  'البريد الإلكتروني',
  'كلمة المرور',
  "page.locator('.app-shell')",
  "name: 'شاشة البيع'",
], 'Authenticated POS smoke')

if (/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i.test(spec)) {
  throw new Error('Authenticated E2E spec must not hardcode an email credential')
}

const workflow = read('.github/workflows/e2e.yml')
requireMarkers(workflow, [
  'workflow_dispatch',
  'secrets.E2E_CASHIER_EMAIL',
  'secrets.E2E_CASHIER_PASSWORD',
  'Require authorized E2E credentials',
  'playwright install --with-deps chromium',
  'npm run test:e2e',
], 'Authenticated E2E workflow')

const tableControls = read('src/modules/pos/TableOrderControls.tsx')
requireMarkers(tableControls, [
  'canTransfer',
  "order.order_type !== 'dine_in'",
  'transferOrderTable',
  'mergeDineInOrders',
  'نقل الطلب',
  'دمج في الطلب الحالي',
], 'Table order controls')

const posService = read('src/modules/pos/pos.service.ts')
requireMarkers(posService, [
  "rpc('transfer_order_table'",
  "rpc('merge_dine_in_orders'",
  'p_idempotency_key: crypto.randomUUID()',
], 'Table RPC service')

const packageJson = JSON.parse(read('package.json'))
if (packageJson.scripts?.['test:e2e'] !== 'playwright test') throw new Error('test:e2e script is not wired to Playwright')
if (!packageJson.devDependencies?.['@playwright/test']) throw new Error('@playwright/test dependency is missing')

console.log('Batch 12 authenticated E2E harness and table-operation guard: PASS')
