# POS.V2 — Canonical Build Plan

> Source of Truth for build progress.

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
- No merge to `main` before final release gate and explicit approval.

---

# Completed core phases

- ✅ Repository / architecture foundation
- ✅ Auth / branches / permission-first authorization
- ✅ First Super Admin bootstrap
- ✅ Catalog
- ✅ Inventory ledger / warehouses / product mapping / BOM
- ✅ Shifts / cash drawer
- ✅ POS Core
- ✅ Kitchen / KDS
- ✅ Payments

## Kitchen verification
- Initial send + delta-only subsequent sends.
- Exact Kitchen-linked stock consumption/reversal.
- KDS queued -> preparing -> ready -> completed.
- Verify #64 green.

## Payments verification
- Cash/Card, partial/split payments, idempotency and overpayment prevention.
- Cash affects drawer; card does not.
- Paid-order close permission separated.
- Verify #79 green.

---

# Current phase — POS Operational Completion 🚧

## 1. Discounts ✅

- Fixed / percentage discount.
- `pos.discount.apply`.
- Reason + actor + timestamp audit.
- Server-derived totals and recalculation after quantity changes.
- No discount changes after payment starts.
- Verify push #97 green.

## 2. Cancel / Void ✅

- Pre-kitchen Cancel remains separate from post-kitchen Void.
- `pos.order.cancel` and `pos.order.void` are separate.
- Void reverses exact Kitchen-linked inventory movements.
- Void blocked after payment starts; paid orders use Return/Refund.
- Reason / actor / timestamp / idempotency audit.
- Missing FK index fixed forward-only.
- Verify push #107 green.

## 3. Return / Refund ✅

Completed:
- Added `pos.order.return` and `pos.payment.refund` permissions.
- Added `order_returns`, `order_return_items`, and `refunds` with branch-scoped RLS.
- Partial line returns with cumulative quantity protection; returned quantity can never exceed sold quantity.
- Refund value is server-derived from the original sale price after proportional order discount.
- Refund allocations are linked to original payments and cannot exceed their original allocation after prior refunds.
- Cash refund requires the current operator to have an open shift and creates `cash_out` atomically.
- Card refund creates no cash-drawer movement.
- Fully refunded payment is marked `refunded`.
- Full quantity return moves order to `returned`; partial return preserves the original paid/closed state.
- Restock is explicit per return line; no automatic inventory restoration.
- Kitchen stock movements now carry `source_order_item_id` lineage; historical Kitchen movements were backfilled where deterministic.
- Restock uses exact historical Kitchen consumption per order item instead of current BOM configuration.
- If historical stock lineage is unavailable, Restock fails closed rather than inventing inventory.
- Return/Refund command is one atomic server transaction and idempotent.
- Permission-aware Returns section added to the RTL sidebar and UI.
- UI shows sold / previously returned / remaining quantities, optional Restock warehouse, estimated net refund and available original payment sources.

Verification:
- Security Advisor: no Return/Refund-specific security regression; only existing Auth leaked-password warning remains.
- Performance Advisor: missing `order_return_items.branch_id` FK index found and fixed forward-only.
- After fix, only expected `unused_index` INFO remains on the fresh database.
- Verify #119: Typecheck / Build ✅.
- Final post-index Verify #121 is the release check for this phase; deployment must be green before moving the gate.

## 4. Split Bill 🚧

Next contract:
- Split quantities or payment responsibility without duplicating revenue.
- Atomic server command.
- Preserve original order audit trail.
- Keep Kitchen tickets / sent quantities consistent.
- Prevent split after incompatible payment state.
- Permission: `pos.order.split`.

## 5. Table Transfer / Merge ⏳

- Transfer dine-in order only to an available table.
- Merge through one atomic command.
- No duplicate active occupancy.
- Preserve order/ticket/payment history.

## 6. Receipt / Reprint Contract ⏳

- `pos.receipt.print` first print.
- `pos.receipt.reprint` separate permission.
- Reprint audit.
- Centralized print logic.

## 7. Customer Display ⏳

- Read-only order/payment projection.
- No write authority.

POS Operational Completion DoD:
- Full cashier lifecycle works with granular permissions and no role-name checks.
- Security/Performance Advisor reviewed.
- Verify and deployment green.

---

# Remaining phases

## I — Procurement / Purchasing ⏳
- Suppliers, purchase documents/lines, receipt workflow, costing, warehouse receipt, approval.

## J — Waste / Counts / Approvals ⏳
- Waste documents, real warehouse/item selection, stock count sessions, variance and approval center.

## K — Accounting / Treasury ⏳
- Chart of accounts, journals, expenses, cash/bank treasury, idempotent posting, trial balance, ledger, income statement, balance sheet, AR/AP aging.

## L — Reports ⏳
- One consolidated table-first page, no chart clutter.
- Branch/date/payment/employee/product/order-type filters.
- Totals, custom columns, Excel export and print.

## M — Printing ⏳
- Kitchen ticket, receipt, shift close, day close and reports.

## N — Offline Critical Operations ⏳
- Shift/day close and required printing only, with queue/idempotency/retry/conflict state.

## O — Settings / Administration UX ⏳
- Branches, warehouses, users, role templates, effective permissions, user creation controls, POS/Kitchen/Print settings and guided setup.

## P — UI / UX Finalization ⏳
- Arabic RTL primary / English LTR secondary.
- Sidebar right in Arabic / left in English.
- Mobile drawer, collapsible sidebar, touch-friendly controls and final glass layer.

## Q — Full Verification / E2E ⏳

Required final cycle:
1. Login Super Admin.
2. Create branch / warehouse / normal user.
3. Grant scoped permissions.
4. Create product + inventory mapping/BOM.
5. Receive stock.
6. Open shift.
7. Create order.
8. Send to Kitchen and verify exact stock deduction.
9. Edit and send delta only.
10. KDS preparing -> ready.
11. Discount / payment / split payment.
12. Refund/return and drawer verification.
13. Close order and shift.
14. Reports/accounting.
15. Cross-branch and missing-permission denial tests.

---

# Security / Hardening backlog

- Enable Supabase Auth leaked-password protection before release: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Review unused-index INFO after realistic workload; do not delete useful indexes merely to silence the linter.
- Keep service/database credentials outside client and repository history.

# Final release gate

No merge `development` -> `main` until all are true:
- POS Operational Completion ✅
- Procurement ✅
- Waste/Counts/Approvals ✅
- Accounting/Treasury ✅
- Reports ✅
- Printing ✅
- Offline close ✅
- Settings/UI finalization ✅
- Full E2E ✅
- Security hardening ✅
- Release-candidate Verify/Deploy ✅
- No known P0/P1 regression ✅
- Explicit release approval ✅
