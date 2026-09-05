import { existsSync, readFileSync } from 'node:fs'

function read(path) {
  if (!existsSync(path)) throw new Error(`Missing required file: ${path}`)
  return readFileSync(path, 'utf8')
}

function requireText(path, snippets) {
  const text = read(path)
  for (const snippet of snippets) {
    if (!text.includes(snippet)) throw new Error(`${path} is missing Batch 6 contract marker: ${snippet}`)
  }
}

const migrations = [
  ['supabase/migrations/20260905165620_supplier_foundation.sql', ['procurement.suppliers.manage', 'create_supplier']],
  ['supabase/migrations/20260905165954_purchase_documents_and_lines.sql', ['procurement.purchases.create', 'purchase_order_lines']],
  ['supabase/migrations/20260905173029_purchase_atomic_receiving.sql', ['procurement.purchases.receive', 'purchase_receipts', 'stock_movements']],
  ['supabase/migrations/20260905173904_purchase_workflow_and_cost_history.sql', ['procurement.purchases.submit', 'procurement.purchases.cancel', 'inventory_item_purchase_cost_history']],
  ['supabase/migrations/20260905175458_formal_waste_documents.sql', ['waste_documents', 'inventory.waste', 'post_waste_document']],
  ['supabase/migrations/20260905181306_stock_count_sessions_and_variance.sql', ['stock_count_sessions', 'pending_approval', 'variance_quantity', 'inventory.count']],
  ['supabase/migrations/20260905181713_approval_center_stock_count_variance.sql', ['approvals.view', 'approvals.review', 'approvals.self_review', 'self approval is not allowed', 'count_adjustment']],
]

for (const [path, snippets] of migrations) requireText(path, snippets)
requireText('docs/DATABASE_IDENTITY_LOCK.md', ['scpovyrqmsbiduanykod'])
requireText('.github/workflows/verify.yml', ['https://scpovyrqmsbiduanykod.supabase.co'])

requireText('src/modules/procurement/PurchasesPage.tsx', ['receivePurchaseOrder', 'submitPurchaseOrder', 'cancelPurchaseOrder'])
requireText('src/modules/inventory/WastePage.tsx', ['createWasteDocument', 'addWasteDocumentLine', 'postWasteDocument'])
requireText('src/modules/inventory/StockCountPage.tsx', ['createStockCountSession', 'setStockCountLine', 'submitStockCountSession', 'pending_approval'])
requireText('src/modules/approvals/ApprovalCenterPage.tsx', ['reviewStockCountApproval', "handleReview('approve')", "handleReview('reject')"])
requireText('src/app/App.tsx', ["can('inventory.waste')", "can('inventory.count')", "can('approvals.view')", "can('approvals.review')"])

const guardedSources = [
  'src/modules/procurement/PurchasesPage.tsx',
  'src/modules/procurement/purchase.service.ts',
  'src/modules/inventory/WastePage.tsx',
  'src/modules/inventory/waste.service.ts',
  'src/modules/inventory/StockCountPage.tsx',
  'src/modules/inventory/count.service.ts',
  'src/modules/approvals/ApprovalCenterPage.tsx',
  'src/modules/approvals/approval.service.ts',
].map(read).join('\n')

if (/role\s*===|role_name\s*===|\.role\s*===/.test(guardedSources)) {
  throw new Error('Role-label authorization detected in Batch 6 feature code')
}

for (const marker of [
  '.from(\'waste_documents\').insert',
  '.from(\'waste_document_lines\').insert',
  '.from(\'stock_count_sessions\').insert',
  '.from(\'stock_count_lines\').insert',
  '.from(\'approval_requests\').insert',
]) {
  if (guardedSources.includes(marker)) throw new Error(`Direct sensitive table write reintroduced: ${marker}`)
}

console.log('Batch 6 repository contract regression guard: PASS')
