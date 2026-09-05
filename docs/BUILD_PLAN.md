# POS.V2 — Canonical Build Plan

> Source of Truth for build progress and build batches.

Repository: `Premieros/pos.v2`  
Development branch: `development`  
Locked Supabase project: `scpovyrqmsbiduanykod`  
Development preview: `https://premieros.github.io/pos.v2/`

## Mandatory rules

- Clean-room rebuild; legacy implementation is requirements reference only.
- Database identity is locked to `scpovyrqmsbiduanykod`.
- Permission-first authorization; feature code never authorizes by role label.
- Hidden immutable `super_admin` owns all permissions and global branch scope.
- Normal users require branch access + effective permission.
- All exposed business tables use RLS.
- Critical POS, inventory, kitchen, shift, payment, approval and accounting mutations are server-authoritative atomic commands.
- Applied migrations are forward-only.
- Do not weaken RLS/tests to make failures pass.
- Missing prerequisites use guided setup instead of raw DB errors.
- Every build batch is isolated; do not mix later-batch work into the current batch without a proven contract dependency.
- A batch is not ✅ until functional scope, permissions/RLS, Security/Performance Advisor, Typecheck, Build and Pages Deploy are green.
- No merge to `main` before the final release gate and explicit approval.

---

# Build batches

## Batch 1 — Platform Foundation ✅ CLOSED

- Repository / React / TypeScript / Vite foundation.
- Supabase client and database identity lock.
- Auth profiles and branch context.
- Permission-first authorization.
- Hidden immutable Super Admin and first bootstrap.
- GitHub Verify and Pages deployment from `development`.

## Batch 2 — Catalog, Inventory & Shift Foundation ✅ CLOSED

- Categories and products.
- Warehouses and inventory items.
- Inventory movement ledger and derived balances.
- Ready-product mapping and BOM/components.
- Receipt / adjustment / waste movement / warehouse transfer.
- Open/close shift and cash-drawer movements.

## Batch 3 — POS Core, Kitchen & Payments ✅ CLOSED

- Five POS order types.
- Dining tables and occupancy.
- Order/item lifecycle, Hold/Resume/Cancel.
- Kitchen send with exact delta and inventory effect.
- KDS queued -> preparing -> ready -> completed.
- Cash/Card, partial and multi-payment.
- Server-authoritative balance and drawer linkage.
- Paid-order close.

Verification:
- Kitchen Verify #64 ✅
- Payments Verify #79 ✅

## Batch 4 — POS Operational Controls I ✅ CLOSED

- Discounts.
- Pre-kitchen Cancel vs post-kitchen Void.
- Return / Refund.
- Explicit Restock from historical Kitchen stock lineage.
- Split Bill inside the original order without duplicating revenue.
- Payment collection against split parts.

Verification:
- Discounts Verify #97 ✅
- Cancel/Void Verify #107 ✅
- Return/Refund post-index Verify #121 ✅
- Split Bill Verify #135 ✅

Split Bill closed contract:
- 2–6 split parts.
- No duplicated order or revenue.
- Full quantity allocation validation.
- Server-calculated split totals with rounding reconciliation.
- Cash/Card per split part.
- General order payment blocked once a split exists.
- Order derives `partially_paid` / `paid` from actual paid total.
- `pos.order.split` remains independent from `pos.payment.take`.

---

## Batch 5 — POS Operational Controls II 🚧 CURRENT

### 5.1 Table Transfer ✅

Closed contract:
- Dine-in orders only.
- `pos.order.transfer` required independently.
- Target table must exist, be active, belong to the same branch and be unoccupied.
- Works on active dine-in states without recreating the order or touching payment history.
- Reason, actor, timestamp and idempotency audit in `order_table_actions`.
- Cross-branch target is rejected server-side.

### 5.2 Table Merge ✅

Closed contract:
- Atomic server command `merge_dine_in_orders`.
- Same branch, same shift, dine-in orders only.
- Source and target remain historically identifiable; source becomes `merged` and stores `merged_into_order_id`.
- Order items and Kitchen tickets move to the target order without duplication.
- Target totals and guest count recalculate server-side.
- Kitchen aggregate state recalculates after merge.
- Merge fails closed if either order has payment history, Split Bill, Return history or an active discount.
- No payment or revenue rows are copied.
- Reason, actor, timestamp and idempotency audit.

Database migrations:
- `20260905163626_pos_table_transfer_and_merge_contract`
- `20260905164017_order_table_actions_table_indexes`

Frontend:
- Permission-aware Transfer/Merge controls inside POS.
- Only free destination tables are offered for transfer.
- Merge candidates are active dine-in orders; final validation remains server-authoritative.

Verification:
- Security Advisor: no Table Transfer/Merge database security regression; only the existing Supabase Auth leaked-password warning remains.
- Performance Advisor: two missing table-action FK indexes were detected and fixed forward-only.
- After the fix, no missing FK warning remains for this contract; remaining notices are expected fresh-database `unused_index` INFO.
- Verify #151 ✅ — Typecheck / Build / GitHub Pages Deploy all green.

### 5.3 Receipt first-print contract 🚧 NEXT

Required:
- `pos.receipt.print` required for first receipt print.
- Server-side print registration; UI alone must not decide first-print state.
- Receipt projection must come from immutable/authoritative order-payment data.
- First print is auditable and idempotent.

### 5.4 Reprint audit ⏳

Required:
- `pos.receipt.reprint` separate permission.
- Reprint reason required.
- Actor / timestamp / print sequence audit.
- Reprint must never mutate the sale.

### 5.5 Customer Display ⏳

Required:
- Read-only order/payment projection.
- No write authority.
- No sensitive admin/permission data.

### 5.6 Batch 5 cashier regression ⏳

Required:
- Complete cashier lifecycle regression across POS Core, Kitchen, discounts, void, split, payment, return/refund, transfer/merge and receipt.
- Cross-branch and missing-permission actions denied.
- Security/Performance Advisor reviewed.
- Final Batch 5 Verify / Build / Deploy green.

Status: 🚧 CURRENT — immediate target: **Receipt first-print contract**.

---

## Batch 6 — Procurement & Stock Control ⏳ QUEUED

1. Suppliers.
2. Purchase documents and lines.
3. Purchase receipt -> warehouse inventory atomically.
4. Purchase workflow and costing history.
5. Formal waste documents.
6. Stock count sessions and variance.
7. Approval center for sensitive inventory operations.

Rules:
- Real branch + warehouse + inventory-item references only.
- No direct balance editing.
- No self-approval unless explicitly permitted.
- Granular purchasing/stock permissions.

## Batch 7 — Accounting & Treasury ⏳ QUEUED

1. Chart of Accounts.
2. Journal entries and lines.
3. Expenses.
4. Cash/bank treasury accounts.
5. Source-transaction linkage.
6. Idempotent automatic posting.
7. Trial Balance / Ledger / Income Statement / Balance Sheet / AR & AP aging.

Rules:
- Server-side idempotent posting.
- Operational records remain source of truth.
- No fake balancing entries.

## Batch 8 — Reports & Central Printing ⏳ QUEUED

Reports:
- One consolidated table-first page; no chart clutter.
- Branch/date/payment/employee/product/order-type filters.
- Totals, custom columns, Excel export and print.
- Sales/invoices, purchases, expenses/profit, inventory/consumption, returns/waste and accounting reports.

Central printing:
- Kitchen ticket.
- Receipt.
- Shift close.
- Day close.
- Reports.
- Business rules remain outside print components.

## Batch 9 — Administration, Offline & Final UX ⏳ QUEUED

Administration:
- Branches, warehouses, users.
- Role templates and effective permissions.
- Direct user grants/revokes.
- User-creation controls.
- POS / Kitchen / Print settings.
- Guided setup.

Offline critical scope:
- Shift close.
- Day close.
- Required close/receipt printing.
- Local queue, idempotency, retry, conflict and sync states.

Final UX:
- Arabic RTL primary / English LTR secondary.
- Sidebar right in Arabic / left in English.
- Mobile drawer and collapsible sidebar.
- Touch-friendly layouts.
- Final iOS-inspired glass layer after operational contracts stabilize.

## Batch 10 — Full Verification & Release Candidate ⏳ QUEUED

Required automated layers:
- Typecheck.
- Build.
- Unit tests.
- DB contract tests.
- RLS / permission tests.
- Integration tests.
- E2E smoke.
- Security Advisor.
- Performance Advisor review.

Mandatory E2E cycle:
1. Login Super Admin.
2. Create branch / warehouse / normal user.
3. Grant scoped permissions.
4. Create product + inventory mapping/BOM.
5. Receive stock.
6. Open shift.
7. Create order.
8. Send Kitchen quantity and verify exact stock deduction.
9. Edit and send delta only.
10. KDS preparing -> ready.
11. Discount / Split Bill / Cash + Card payment.
12. Table transfer/merge.
13. Receipt / reprint permission scenario.
14. Return/refund and cash-drawer verification.
15. Close order and shift/day.
16. Purchase / stock count / waste / accounting posting.
17. Reports reconciliation.
18. Cross-branch and missing-permission attempts denied.
19. Offline close/retry scenario.

---

# Current checkpoint

- Locked database: `scpovyrqmsbiduanykod` ✅
- Repository: `Premieros/pos.v2` ✅
- Branch: `development` ✅
- Verified implementation HEAD before this log update: `50c864f2f2fa352dedba949e85d243a4c97d9f06`.
- Verify #151: ✅ Typecheck / Build / GitHub Pages Deploy.
- Batches 1–4: ✅ CLOSED.
- Batch 5: 🚧 CURRENT.
- Table Transfer / Merge: ✅ CLOSED.
- Immediate implementation target: **Receipt first-print contract**.
- `main` remains untouched.

# Security / Hardening backlog

- Enable Supabase Auth leaked-password protection before release: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Review unused-index INFO after realistic workload; do not delete useful indexes merely to silence the linter.
- Keep service/database credentials outside client and repository history.

# Final release gate

No merge `development` -> `main` until all are true:
- Batch 5 POS Operational Controls II ✅
- Batch 6 Procurement & Stock Control ✅
- Batch 7 Accounting & Treasury ✅
- Batch 8 Reports & Central Printing ✅
- Batch 9 Administration / Offline / Final UX ✅
- Batch 10 Full Verification & Release Candidate ✅
- Security hardening ✅
- No known P0/P1 regression ✅
- Explicit release approval ✅
