import { readFileSync, existsSync } from 'node:fs'

function read(path) {
  if (!existsSync(path)) throw new Error(`Missing required file: ${path}`)
  return readFileSync(path, 'utf8')
}

function requireText(path, snippets) {
  const text = read(path)
  for (const snippet of snippets) {
    if (!text.includes(snippet)) throw new Error(`${path} is missing contract marker: ${snippet}`)
  }
}

const migrationChecks = [
  ['supabase/migrations/20260905150307_pos_order_discount_contract.sql', ['pos.discount.apply']],
  ['supabase/migrations/20260905150903_pos_post_kitchen_void_contract.sql', ['pos.order.void', 'void_pos_order']],
  ['supabase/migrations/20260905155132_return_refund_and_stock_lineage_contract.sql', ['pos.order.return', 'pos.payment.refund', 'return_order']],
  ['supabase/migrations/20260905155805_split_bill_contract.sql', ['pos.order.split', 'create_order_bill_split', 'take_split_payment']],
  ['supabase/migrations/20260905163626_pos_table_transfer_and_merge_contract.sql', ['pos.order.transfer', 'transfer_order_table', 'merge_dine_in_orders', "status='merged'"]],
  ['supabase/migrations/20260905164257_receipt_first_print_and_reprint_contract.sql', ['pos.receipt.print', 'pos.receipt.reprint', 'register_first_receipt_print', 'register_receipt_reprint']],
  ['supabase/migrations/20260905164722_customer_display_read_only_projection.sql', ['get_customer_display_projection', 'pos.view']],
]

for (const [path, snippets] of migrationChecks) requireText(path, snippets)

requireText('docs/DATABASE_IDENTITY_LOCK.md', ['scpovyrqmsbiduanykod'])
requireText('.github/workflows/verify.yml', ['https://scpovyrqmsbiduanykod.supabase.co'])
requireText('src/modules/pos/PosPage.tsx', [
  "can('pos.order.void')",
  "can('pos.order.split')",
  "can('pos.order.transfer')",
  "can('pos.receipt.print')",
  "can('pos.receipt.reprint')",
  '<CustomerDisplayControls order={selectedOrder} />',
])
requireText('src/modules/customer-display/CustomerDisplayControls.tsx', ['getCustomerDisplayProjection', 'setInterval', 'window.open'])
requireText('src/modules/receipts/ReceiptControls.tsx', ['registerFirstReceiptPrint', 'registerReceiptReprint'])

const posSources = [
  read('src/modules/pos/PosPage.tsx'),
  read('src/modules/pos/pos.service.ts'),
  read('src/modules/pos/TableOrderControls.tsx'),
].join('\n')

if (posSources.includes("can('pos.sell')") || posSources.includes('pos.sell')) {
  throw new Error('Broad pos.sell authority reintroduced into POS operational code')
}
if (/role\s*===|role_name\s*===|\.role\s*===/.test(posSources)) {
  throw new Error('Role-label authorization detected in POS operational code')
}

console.log('Batch 5 repository contract regression guard: PASS')
