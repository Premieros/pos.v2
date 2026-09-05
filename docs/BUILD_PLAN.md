# POS.V2 — Canonical Build Plan

> Source of Truth for build progress.
>
> Repository: `Premieros/pos.v2`  
> Development branch: `development`  
> Locked Supabase project: `scpovyrqmsbiduanykod`  
> Development preview: `https://premieros.github.io/pos.v2/`

## Mandatory rules

- Clean-room rebuild; legacy implementation is requirements reference only.
- Database identity is locked to `scpovyrqmsbiduanykod`; no migration, seed, secret, dump, or connection from another project may be mixed into POS.V2.
- Permission-first authorization: feature code checks permission keys, never role names.
- `super_admin` is a hidden immutable platform role, owns every permission, receives future permissions automatically, and has platform-wide branch access.
- Normal users require branch access + effective permission.
- Every exposed business table uses RLS.
- Critical POS, inventory, kitchen, shift, payment, approval and accounting mutations are server-authoritative atomic commands.
- No direct client multi-table transaction logic.
- No weakening RLS/tests to make failures disappear.
- Applied migrations are forward-only.
- Missing prerequisites use guided setup, not raw database errors.
- No merge to `main` before the final release gate and explicit approval.

---

# Phase status

## A — Repository / Architecture ✅

Completed:
- React + TypeScript + Vite clean foundation.
- Development rules and system contract.
- Supabase browser client with public configuration only.
- GitHub Verify pipeline.
- GitHub Pages deployment from `development` after successful Verify.

## B — Auth / Branches / Permissions ✅

Completed:
- Profiles and automatic Auth profile trigger.
- Branches and branch context.
- Permissions, roles, role permissions and direct user overrides.
- Hidden immutable `super_admin` in private platform assignment storage.
- One-time initial bootstrap.
- Initial Auth user and `MAIN` branch created.
- Super Admin assignment verified.
- No public signup path for ordinary user administration.
- No-privilege-escalation rules for user permission/role administration.

Current verified Super Admin state:
- Platform assignment: ✅
- Branch access: ✅
- Owns all current permission definitions: ✅
- Password/secret values are never recorded in GitHub.

## C — Catalog ✅

Completed:
- Categories.
- Products.
- Branch isolation.
- SKU/barcode uniqueness inside branch.
- Pricing and activation.
- Ready-product direct inventory mapping.
- BOM mapping through `product_components`.
- Direct mapping and BOM are mutually exclusive.

Deferred enhancements:
- Modifier groups/options.
- Modifier min/max rules.
- Product images.
- Advanced tax/pricing settings.

## D — Inventory ✅

Completed:
- Warehouses.
- Inventory items.
- Stock movement ledger.
- Derived balances.
- Receipt.
- Adjustment.
- Waste movement.
- Transfer between warehouses.
- BOM/component consumption contract.
- Ready-product inventory mapping.
- Negative stock prevention on outgoing commands.
- Idempotency for critical stock movements.
- Inventory UI and mapping setup.

Still planned later:
- Formal count documents.
- Approval workflow for sensitive adjustments.
- Purchase receipt linkage.
- Low-stock alert UX.

## E — Shifts / Cash Drawer ✅

Completed:
- Open shift.
- Opening balance.
- Cash-in / cash-out drawer movements.
- Close shift.
- Expected cash / actual cash / difference.
- Permission-scoped own/manager visibility.
- RLS/policy hardening.

Extensions still planned:
- End-of-day close.
- Printed close report.
- Offline close queue.

## F — POS Core ✅

Completed order types:
- Dine-in.
- Take Away.
- Drive Thru.
- Delivery.
- Quick Order.

Completed:
- Orders and order items.
- Dining tables and occupancy protection.
- Shift requirement.
- Server-calculated totals.
- Create/add/edit/remove/hold/resume/cancel commands.
- Independent product-area scroll.
- Compact product tiles.
- Guided message when shift is missing.
- Fine-grained permissions; no broad `pos.sell` authority.

## G — Kitchen / KDS ✅

Completed backend:
- `kitchen_tickets` and `kitchen_ticket_items`.
- Initial send creates a ticket only for unsent quantities.
- `sent_quantity` tracks delivered kitchen quantity.
- Later edits create delta only.
- Removal after send creates negative delta.
- Kitchen send + stock deduction/reversal are one transaction.
- BOM consumption and ready-product consumption.
- Missing stock mapping rejects the transaction.
- Insufficient stock rejects the transaction.
- KDS transitions: queued -> preparing -> ready -> completed.
- Order state follows kitchen state.
- Permission-aware KDS queue counter for POS.

Completed frontend:
- Warehouse selection before kitchen send.
- Guided prerequisite when no warehouse exists.
- `Send to Kitchen` / `Send Changes` button.
- Unsynced-delta indicator.
- KDS page.
- Start / Ready / Complete actions.
- KDS counter inside POS.

Verification:
- Verify #64: Install / Typecheck / Build / GitHub Pages Deploy ✅
- Database Security Advisor: no Kitchen-specific security regression.
- Performance Advisor: no missing Kitchen FK index.

## H — Payments ✅

Completed schema:
- `payments`.
- `payment_allocations`.

Completed commands:
- Cash payment.
- Card payment.
- Partial payment.
- Split payment through multiple payment rows/allocations.
- Server-authoritative remaining balance.
- Payment idempotency.
- Overpayment prevention.
- Payment allowed only for valid ready/partially-paid states.
- Cash payment inserts drawer cash-in inside the same transaction.
- Card payment does not affect expected physical cash.
- Order status updates to `partially_paid` / `paid`.
- Fully-paid order close command with separate `pos.order.close` permission.

Completed POS UI:
- Total / paid / remaining.
- Payment history.
- Cash/Card selector.
- Partial amount entry.
- Close order after full payment.

Verification:
- Verify #79: Install / Typecheck / Build / GitHub Pages Deploy ✅
- Missing `payment_allocations.branch_id` FK index fixed.
- Remaining performance notices are unused-index INFO expected on a new database.

---

# Current phase — POS Operational Completion 🚧

## 1. Discounts ⏳

Required:
- `pos.discount.apply` command.
- Fixed and percentage discount.
- Reason/audit fields.
- Server recalculation of totals.
- Optional approval threshold contract.
- No client-authoritative discount total.

## 2. Cancel / Void ⏳

Required:
- Keep pre-kitchen cancel separate from post-kitchen void.
- Add granular void permission.
- Correct inventory reversal for already-sent quantities.
- Correct payment treatment if money already exists.
- Reason + actor + timestamp audit.

## 3. Return / Refund ⏳

Required:
- Separate return permission.
- Return lines/quantities.
- Refund records linked to original payment.
- Cash refund affects drawer; card refund does not count as cash.
- Inventory return rules explicit and auditable.
- Idempotency.

## 4. Split Bill ⏳

Required:
- Split quantities or payment responsibility without duplicating revenue.
- Atomic command.
- Preserve original order audit trail.

## 5. Table Transfer / Merge ⏳

Required:
- Transfer dine-in order only to an available table.
- Merge through one atomic command.
- No duplicate active occupancy.
- Preserve order/ticket/payment history.

## 6. Receipt / Reprint Contract ⏳

Required:
- `pos.receipt.print` first print.
- `pos.receipt.reprint` separate permission.
- Reprint audit.
- Printing logic centralized; no business logic inside print components.

## 7. Customer Display ⏳

Required:
- Read-only order/payment projection.
- No write authority.

POS Operational Completion DoD:
- Full cashier lifecycle works with granular permissions and no role-name checks.
- Security/Performance Advisor reviewed.
- Verify and deployment green.

---

# Remaining phases

## I — Procurement / Purchasing ⏳

- Suppliers.
- Purchase documents and lines.
- Warehouse receipt.
- Purchase status workflow.
- Purchase cost history.
- Receipt -> inventory ledger atomically.
- Optional approval.

## J — Waste / Counts / Approvals ⏳

- Waste document header/lines.
- Mandatory branch + warehouse + real inventory item.
- Count sessions and variance.
- Approval center.
- No self-approval unless explicit permission.
- Audit trail.

## K — Accounting / Treasury ⏳

- Chart of accounts.
- Journal entries / lines.
- Expenses.
- Cash/bank treasury accounts.
- Source transaction linkage.
- Idempotent automatic postings.
- Trial balance.
- Ledger.
- Income statement.
- Balance sheet.
- AR/AP aging.

## L — Reports ⏳

Final UX:
- One consolidated page.
- Table-first; no chart clutter.
- Branch/date/payment/employee/product/order-type filters.
- Totals.
- Custom columns.
- Excel export.
- Print.

Required domains:
- Sales and invoices.
- Sales by payment/employee/product.
- Purchases.
- Expenses/profit.
- Inventory and consumption.
- BOM/recipe cost.
- Top products/items.
- Low stock.
- Cashier performance.
- Returns/waste.
- Accounting reports.

## M — Printing ⏳

Centralized printing module:
- Kitchen ticket.
- Receipt.
- Shift close.
- Day close.
- Reports.

## N — Offline Critical Operations ⏳

Limited scope only:
- Shift close.
- Day close.
- Required close/receipt printing.
- Local queue + idempotency + retry + conflict state.

## O — Settings / Administration UX ⏳

- Branches.
- Warehouses.
- Users.
- Roles/templates.
- Effective permissions and direct overrides.
- User creation controls.
- POS/Kitchen/Print settings.
- Guided setup.

## P — UI / UX Finalization ⏳

- Arabic RTL primary.
- English LTR secondary.
- Sidebar right for Arabic / left for English.
- Mobile drawer.
- Collapsible sidebar.
- Touch-friendly controls.
- iOS-inspired glass layer after business flows stabilize.
- Loading/error/empty/unauthorized states.

## Q — Full Verification / E2E ⏳

Required automated layers:
- Typecheck.
- Build.
- Unit.
- DB contract tests.
- RLS/permission tests.
- Integration.
- E2E smoke.

Critical operational E2E:
1. Login as Super Admin.
2. Create branch/warehouse/user.
3. Grant scoped permissions.
4. Create product + inventory/BOM.
5. Receive stock.
6. Open shift.
7. Create order.
8. Send initial kitchen quantity.
9. Verify exact stock deduction.
10. Edit and send delta only.
11. KDS preparing -> ready.
12. Split cash/card payment.
13. Verify drawer cash only.
14. Close order.
15. Close shift.
16. Verify reports/accounting.
17. Attempt cross-branch and missing-permission actions and confirm denial.

---

# Security / Hardening backlog

- Enable Supabase Auth leaked-password protection before release.
- Review unused-index notices after realistic workload exists; do not delete useful indexes merely to silence INFO notices.
- Keep Security Advisor free of unresolved database/RLS errors.
- Keep all service-role/database credentials outside client and repository history.

# Final release gate

Do not merge `development` into `main` until all are true:
- POS Operational Completion ✅
- Procurement ✅
- Waste/Counts/Approvals ✅
- Accounting/Treasury ✅
- Reports ✅
- Printing ✅
- Offline close requirements ✅
- Settings/UI finalization ✅
- Full E2E ✅
- Security hardening ✅
- Release-candidate Verify/Deploy ✅
- No known P0/P1 regression ✅
- Explicit release approval ✅
