import { existsSync, readFileSync } from 'node:fs'

function read(path) {
  if (!existsSync(path)) throw new Error(`Missing required file: ${path}`)
  return readFileSync(path, 'utf8')
}

function requireText(path, snippets) {
  const text = read(path)
  for (const snippet of snippets) {
    if (!text.includes(snippet)) throw new Error(`${path} is missing Batch 10 contract marker: ${snippet}`)
  }
  return text
}

const pos = requireText('src/modules/pos/PosPage.tsx', [
  "dine_in: 'صالة'",
  "take_away: 'تيك أواي'",
  "drive_thru: 'درايف ثرو'",
  "delivery: 'دليفري'",
  "quick: 'طلب سريع'",
  'pos-operational-tabs',
  'pos-floor-workspace',
  "event.key === 'F2'",
  "event.key === 'F3'",
  "event.key === 'Enter'",
  'SplitBillControls',
  'ReceiptControls',
  'CustomerDisplayControls',
  'CheckoutPanel',
  'hasBillSplits={hasBillSplits}',
])

for (const permission of [
  "can('pos.view')",
  "can('pos.order.create')",
  "can('pos.order.edit')",
  "can('pos.payment.take')",
  "can('pos.order.split')",
  "can('pos.receipt.print')",
  "can('pos.receipt.reprint')",
  "can('pos.tables.manage')",
]) {
  if (!pos.includes(permission)) throw new Error(`POS permission-first marker missing: ${permission}`)
}

const checkout = requireText('src/modules/payments/CheckoutPanel.tsx', [
  'if (!canPay || !paymentReady || hasBillSplits || !validAmount || !cashValid) return',
  'canPay && paymentReady && !hasBillSplits',
  "method === 'cash'",
  "setMethod('card')",
  "order.status === 'paid'",
])
if (checkout.includes(".from('payments').insert")) throw new Error('Checkout reintroduced a direct payment write')

const splits = requireText('src/modules/splits/split.service.ts', [
  "supabase.rpc('create_order_bill_split'",
  "supabase.rpc('take_split_payment'",
  'p_idempotency_key: crypto.randomUUID()',
])
for (const marker of [".from('order_bill_splits').insert", ".from('payments').insert", ".from('payment_allocations').insert"]) {
  if (splits.includes(marker)) throw new Error(`Split Bill direct protected write detected: ${marker}`)
}

const receipts = requireText('src/modules/receipts/receipt.service.ts', [
  "supabase.rpc('get_receipt_print_state'",
  "supabase.rpc('register_first_receipt_print'",
  "supabase.rpc('register_receipt_reprint'",
  'p_idempotency_key: crypto.randomUUID()',
])
if (/\.from\([^)]*receipt/i.test(receipts)) throw new Error('Receipt mutation bypassed the server RPC contract')

requireText('src/modules/customer-display/customer-display.service.ts', [
  "supabase.rpc('get_customer_display_projection'",
])
requireText('src/modules/customer-display/CustomerDisplayControls.tsx', [
  "['المدفوع', projection.payment.paid]",
  "['المتبقي', projection.payment.remaining]",
  'window.setInterval(() => void refreshPopup(), 2000)',
])
requireText('src/modules/receipts/ReceiptControls.tsx', [
  "const printableState = ['paid', 'closed'].includes(order.status)",
  'registerFirstReceiptPrint(order.id)',
  'registerReceiptReprint(order.id, reason)',
])
requireText('src/styles/pos-operations.css', ['pos-operational-tabs', 'pos-table-grid', 'touch-action:manipulation'])
requireText('src/main.tsx', ["./styles/pos-operations.css"])

console.log('Batch 10 POS operations + checkout interaction regression guard: PASS')
