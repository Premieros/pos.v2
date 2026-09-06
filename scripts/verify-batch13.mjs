import { existsSync, readFileSync } from 'node:fs'

function read(path) {
  if (!existsSync(path)) throw new Error(`Missing Batch 13 file: ${path}`)
  return readFileSync(path, 'utf8')
}

function requireMarkers(source, markers, label) {
  for (const marker of markers) {
    if (!source.includes(marker)) throw new Error(`${label} lost required marker: ${marker}`)
  }
}

const service = read('src/modules/customers/customer.service.ts')
requireMarkers(service, [
  "rpc('create_customer'",
  "rpc('create_customer_address'",
  "rpc('update_customer'",
  'p_customer_id',
  'p_is_active',
], 'Customer service')
if (/\.from\(['"]customers['"]\)[\s\S]{0,180}\.update\(/.test(service)) {
  throw new Error('Direct protected customer update was introduced')
}

const page = read('src/modules/customers/CustomersPage.tsx')
requireMarkers(page, [
  "can('customers.view')",
  "can('customers.create')",
  "can('customers.manage')",
  'updateCustomer',
  'createCustomerAddress',
  'بحث العملاء',
  'عرض غير النشط',
], 'Customers workspace')

const app = read('src/app/App.tsx')
requireMarkers(app, [
  'CustomersPage',
  "#customers-section",
  "can('customers.view')",
  "can('customers.create')",
  "can('customers.manage')",
], 'App customer navigation')

console.log('Batch 13 customer workspace regression: PASS')
