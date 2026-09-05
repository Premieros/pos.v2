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
- Every build batch is isolated: do not mix work from a later batch into the current batch unless required by a proven contract dependency.
- A batch is not ✅ until its functional scope, permission/RLS checks, Security/Performance Advisor review, Typecheck, Build and GitHub Pages Deploy are green.
- No merge to `main` before final release gate and explicit approval.

---

# Build batches

## Batch 1 — Platform Foundation ✅

Scope:
- Repository / React / TypeScript / Vite foundation.
- Supabase client and database identity lock.
- Auth profiles and branch context.
- Permission-first authorization.
- Hidden immutable Super Admin and first bootstrap.
- GitHub Verify and Pages deployment from `development`.

Status: ✅ CLOSED

---

## Batch 2 — Catalog, Inventory & Shift Foundation ✅

Scope:
- Categories and products.
- Warehouses and inventory items.
- Inventory movement ledger and derived balances.
- Ready-product inventory mapping and BOM/components.
- Receipt / adjustment / waste movement / warehouse transfer.
- Open/close shift and cash-drawer movements.

Status: ✅ CLOSED

---

## Batch 3 — POS Core, Kitchen & Payments ✅

Scope:
- Five POS order types.
- Dining tables and occupancy.
- Order/item lifecycle, Hold/Resume/Cancel.
- Kitchen send with exact delta and inventory effect.
- KDS queued -> preparing -> ready -> completed.
- Cash/Card, partial and multi-payment.
- Server-authoritative balance and drawer linkage.
- Paid-order close.

Key verification:
- Kitchen Verify #64 ✅
- Payments Verify #79 ✅

Status: ✅ CLOSED

---

## Batch 4 — POS Operational Controls I ✅

Scope:
- Discounts.
- Pre-kitchen Cancel vs post-kitchen Void.
- Return / Refund.
- Explicit restock using historical Kitchen stock lineage.
- Split Bill inside the original order without duplicating revenue.
- Payment collection against split parts.

Key verification:
- Discounts Verify #97 ✅
- Cancel/Void Verify #107 ✅
- Return/Refund post-index Verify #121 ✅
- Split Bill Verify #135 ✅ — Typecheck / Build / GitHub Pages Deploy all green.

Split Bill closed contract:
- 2–6 split parts.
- No duplicated order or revenue.
- Full quantity allocation validation.
- Server-calculated split totals with rounding reconciliation.
- Cash/Card per split part.
- General order payment blocked after a split exists.
- Order becomes `partially_paid` / `paid` from actual total paid.
- `pos.order.split` remains independent from `pos.payment.take`.

Status: ✅ CLOSED

---

## Batch 5 — POS Operational Controls II 🚧 CURRENT

Execution order:
1. Table Transfer.
2. Table Merge.
3. Receipt first-print contract.
4. Reprint audit + separate permission.
5. Customer Display read-only projection.
6. Final cashier lifecycle regression for the whole POS operational layer.

Required contract:
- Transfer dine-in order only to an available table.
- Merge is one atomic command and cannot duplicate active occupancy.
- Preserve order, Kitchen, payment and audit history.
- `pos.order.transfer` is independent.
- Receipt first print uses `pos.receipt.print`.
- Reprint uses `pos.receipt.reprint` with reason/actor/timestamp audit.
- Customer Display has read-only projection and no write authority.

Batch 5 DoD:
- Full cashier lifecycle works with granular permissions and no role-name checks.
- Cross-branch transfer/merge denied.
- No duplicate table occupancy.
- Security/Performance Advisor reviewed.
- Verify / Build / Deploy green.

Status: 🚧 CURRENT — next action: **Table Transfer / Merge**.

---

## Batch 6 — Procurement & Stock Control ⏳

Execution order:
1. Suppliers.
2. Purchase documents and lines.
3. Purchase receipt -> warehouse inventory atomically.
4. Purchase status workflow and costing history.
5. Formal waste documents.
6. Stock count sessions and variance.
7. Approval center for sensitive inventory operations.

Rules:
- Real branch + warehouse + inventory-item references only.
- No direct balance editing.
- No self-approval unless an explicit permission allows it.
- Purchasing and stock permissions remain granular.

Status: ⏳ QUEUED

---

## Batch 7 — Accounting & Treasury ⏳

Execution order:
1. Chart of Accounts.
2. Journal entries and lines.
3. Expenses.
4. Cash/bank treasury accounts.
5. Source-transaction linkage.
6. Idempotent automatic posting from operational modules.
7. Trial Balance / Ledger / Income Statement / Balance Sheet / AR & AP aging contracts.

Rules:
- Accounting postings are server-side and idempotent.
- Operational records remain source of truth; journals reference their source transaction.
- No fake balancing entries to silence validation.

Status: ⏳ QUEUED

---

## Batch 8 — Reports & Central Printing ⏳

Reports:
- One consolidated table-first page; no chart clutter.
- Filters: branch, date, payment method, employee, product, order type.
- Totals, custom columns, Excel export and print.
- Sales/invoices, payment/employee/product, purchases, expenses/profit, inventory/consumption, returns/waste and accounting reports.

Printing:
- Central kitchen ticket.
- Receipt.
- Shift close.
- Day close.
- Reports.
- Business rules remain outside print components.

Status: ⏳ QUEUED

---

## Batch 9 — Administration, Offline & Final UX ⏳

Administration:
- Branches, warehouses, users.
- Role templates and effective permissions.
- Direct user grants/revokes.
- User-creation controls.
- POS / Kitchen / Print settings.
- Guided setup for missing prerequisites.

Offline critical scope only:
- Shift close.
- Day close.
- Required close/receipt printing.
- Local queue, idempotency, retry, conflict and pending/synced/error states.

Final UX:
- Arabic RTL primary / English LTR secondary.
- Sidebar right in Arabic / left in English.
- Mobile drawer and collapsible sidebar.
- Touch-friendly layouts.
- Final iOS-inspired glass layer only after operational contracts are stable.

Status: ⏳ QUEUED

---

## Batch 10 — Full Verification & Release Candidate ⏳

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

Mandatory E2E operational cycle:
1. Login as Super Admin.
2. Create branch / warehouse / normal user.
3. Grant scoped permissions.
4. Create product + inventory mapping/BOM.
5. Receive stock.
6. Open shift.
7. Create order.
8. Send initial Kitchen quantity and verify exact stock deduction.
9. Edit and send delta only.
10. KDS preparing -> ready.
11. Discount / Split Bill / Cash + Card payment.
12. Table transfer/merge scenario.
13. Receipt / reprint permission scenario.
14. Return/refund and cash-drawer verification.
15. Close order and shift/day.
16. Purchase / stock count / waste / accounting posting.
17. Reports reconciliation.
18. Cross-branch and missing-permission attempts denied.
19. Offline close/retry scenario.

Status: ⏳ QUEUED

---

# Current checkpoint

- Development HEAD before this planning update: `829d209ee575559ecfaf567cf374646438ee9673`.
- Verify #135: ✅ completed successfully including GitHub Pages Deploy.
- Batches 1–4: ✅ CLOSED.
- Batch 5: 🚧 CURRENT.
- Immediate implementation target: **Table Transfer / Merge**.
- `main` remains untouched until final release gate.

---

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
