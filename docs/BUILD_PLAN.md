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
- Critical mutations are server-authoritative atomic commands.
- Applied migrations are forward-only.
- Do not weaken RLS/tests to make failures pass.
- Missing prerequisites use guided setup instead of raw DB errors.
- Keep build batches isolated; do not pull later-batch work forward without a proven dependency.
- A batch is not ✅ until functional scope, permissions/RLS, Advisors, Typecheck, Build and Pages Deploy are green.
- No merge to `main` before the final release gate and explicit approval.

---

# Build batches

## Batch 1 — Platform Foundation ✅ CLOSED
Repository/Vite/React/TypeScript, Supabase client + DB identity lock, Auth/Branch/Permission contexts, hidden immutable Super Admin/bootstrap, Verify + Pages.

## Batch 2 — Catalog, Inventory & Shift Foundation ✅ CLOSED
Catalog, warehouses/items, ledger balances, ready-product/BOM mapping, receipt/adjust/waste/transfer, shifts and cash drawer.

## Batch 3 — POS Core, Kitchen & Payments ✅ CLOSED
Five order types, tables/occupancy, order lifecycle, Kitchen delta + stock effect, KDS, Cash/Card/partial/multi-payment, drawer linkage and paid-order close.

Verification: Kitchen #64 ✅ · Payments #79 ✅

## Batch 4 — POS Operational Controls I ✅ CLOSED
Discounts, Cancel/Void, Return/Refund with historical restock lineage, Split Bill without duplicated revenue, split-part payment collection.

Verification: Discounts #97 ✅ · Cancel/Void #107 ✅ · Return/Refund #121 ✅ · Split Bill #135 ✅

---

## Batch 5 — POS Operational Controls II 🚧 CURRENT

### 5.1 Table Transfer ✅
- Dine-in only; independent `pos.order.transfer`.
- Same-branch active unoccupied target table required.
- No order recreation or payment mutation.
- Reason/actor/time/idempotency audit.
- Cross-branch fails closed.

### 5.2 Table Merge ✅
- Atomic same-branch/same-shift dine-in merge.
- Source becomes `merged` with `merged_into_order_id`; no deletion.
- Items/Kitchen tickets move to target without duplication.
- Totals/guest count/Kitchen aggregate state recalculate server-side.
- Blocked for payment history, Split Bill, Return history or active discount.
- No payment/revenue rows copied.

Migrations:
- `20260905163626_pos_table_transfer_and_merge_contract`
- `20260905164017_order_table_actions_table_indexes`

Verification: #151 ✅ Typecheck / Build / Pages Deploy. Advisors: no phase-specific security issue or missing FK remains.

### 5.3 Receipt first print ✅
- Independent `pos.receipt.print`.
- Only paid/closed order accepted server-side.
- First print registered server-side and idempotent.
- Immutable snapshot captured from authoritative branch/order/items/completed-payments data.
- Repeated first-print is rejected contractually in favor of Reprint.

### 5.4 Receipt Reprint ✅
- Independent `pos.receipt.reprint`.
- Reason mandatory.
- Actor/time/sequence/idempotency audit.
- Reprint always uses the original immutable snapshot and never mutates the sale.
- POS includes 80mm first-print/reprint output.

Migration:
- `20260905164257_receipt_first_print_and_reprint_contract`

Verification: #163 ✅ Typecheck / Build / Pages Deploy. Advisors: existing Auth warning only; no Receipt missing-FK warning.

Known UX boundary: backend supports closed-order reprint, while historical discovery is deferred to the centralized Printing/Receipt history surface unless an earlier operational need is proven.

### 5.5 Customer Display ✅
- Server-authoritative `get_customer_display_projection` read-only RPC.
- Requires authenticated `pos.view` in the order branch.
- Projection includes only order state, customer-facing items, subtotal/discount/total and paid/remaining amounts.
- No user, admin, role, permission or secret data is projected.
- No Customer Display write RPC exists.
- External customer window has no Supabase client; it receives read-only projection from the authenticated POS and refreshes every 2 seconds.

Migration:
- `20260905164722_customer_display_read_only_projection`

Verification:
- Security Advisor: only existing Supabase Auth leaked-password warning.
- Performance Advisor: no new missing-FK warning; fresh-DB unused-index INFO only.
- Verify #175 ✅ Typecheck / Build / GitHub Pages Deploy.

### 5.6 Batch 5 cashier regression 🚧 NEXT
Required:
- Contract audit for POS Core, Kitchen, discounts, Void, Split Bill, payment, Return/Refund, transfer/merge, receipt/reprint and Customer Display.
- Permission keys and RLS/grant surfaces verified against locked DB.
- Cross-branch and missing-permission behavior fails closed by contract.
- Repository regression guard added to Verify so Batch 5 contracts cannot silently disappear.
- Final Security/Performance review + Verify/Build/Deploy green.

Status: 🚧 CURRENT — immediate target: **Batch 5 cashier regression and closure**.

---

## Batch 6 — Procurement & Stock Control ⏳ QUEUED
Suppliers → purchase documents/lines → atomic warehouse receipt → purchase workflow/cost history → formal waste documents → stock counts/variance → approval center. No direct balance editing; granular permissions; no self-approval without explicit permission.

## Batch 7 — Accounting & Treasury ⏳ QUEUED
COA → journals/lines → expenses → cash/bank treasury → source links → idempotent automatic posting → Trial Balance/Ledger/Income Statement/Balance Sheet/AR/AP aging.

## Batch 8 — Reports & Central Printing ⏳ QUEUED
One table-first reports page with filters/totals/custom columns/Excel/print. Central printing for Kitchen ticket, receipt/history, shift close, day close and reports.

## Batch 9 — Administration, Offline & Final UX ⏳ QUEUED
Branches/warehouses/users/roles/effective permissions/user creation/settings/guided setup; offline critical close/printing queue; Arabic RTL + English LTR, mobile/collapsible sidebar, touch UX and final glass layer.

## Batch 10 — Full Verification & Release Candidate ⏳ QUEUED
Typecheck, Build, Unit, DB contract, RLS/permissions, Integration, E2E smoke, Advisors and complete operational cycle including cross-branch denial and offline retry.

---

# Current checkpoint

- Locked database: `scpovyrqmsbiduanykod` ✅
- Repository: `Premieros/pos.v2` ✅
- Branch: `development` ✅
- Verified implementation HEAD before this log update: `45ada261144e07f9b900d9afd7adee0baa666631`.
- Verify #175: ✅ Typecheck / Build / GitHub Pages Deploy.
- Batches 1–4: ✅ CLOSED.
- Batch 5 feature scope: Transfer/Merge ✅ · Receipt/Reprint ✅ · Customer Display ✅.
- Immediate target: **Batch 5 cashier regression and closure**.
- `main` remains untouched.

# Security / Hardening backlog

- Enable Supabase Auth leaked-password protection before release: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Review unused-index INFO after realistic workload; do not delete useful indexes merely to silence the linter.
- Keep service/database credentials outside client and repository history.

# Final release gate

No merge `development` -> `main` until Batches 5–10 are ✅, security hardening is ✅, no known P0/P1 regression remains, and explicit release approval is given.
