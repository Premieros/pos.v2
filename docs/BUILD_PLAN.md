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
- Keep build batches isolated; no later-batch work without a proven dependency.
- A batch is not ✅ until scope, permissions/RLS, Advisors, regression guard, Typecheck, Build and Pages Deploy are green.
- No merge to `main` before final release gate and explicit approval.

---

# Build batches

## Batch 1 — Platform Foundation ✅ CLOSED
Repository/Vite/React/TypeScript, DB identity lock, Auth/Branch/Permission contexts, hidden Super Admin/bootstrap, Verify + Pages.

## Batch 2 — Catalog, Inventory & Shift Foundation ✅ CLOSED
Catalog, warehouses/items, ledger balances, ready-product/BOM mapping, inventory commands, shifts and cash drawer.

## Batch 3 — POS Core, Kitchen & Payments ✅ CLOSED
Five order types, table occupancy, order lifecycle, Kitchen delta + stock, KDS, Cash/Card/partial/multi-payment, drawer linkage and close.

Verification: Kitchen #64 ✅ · Payments #79 ✅

## Batch 4 — POS Operational Controls I ✅ CLOSED
Discounts, Cancel/Void, Return/Refund + historical restock lineage, Split Bill and split payment collection.

Verification: Discounts #97 ✅ · Cancel/Void #107 ✅ · Return/Refund #121 ✅ · Split Bill #135 ✅

## Batch 5 — POS Operational Controls II ✅ CLOSED

Completed:
- Table Transfer: same-branch active free table, `pos.order.transfer`, audit/idempotency.
- Table Merge: same branch/shift, no revenue duplication, source retained as `merged`, payment/split/return/discount conflicts fail closed.
- Receipt first print: `pos.receipt.print`, authoritative immutable snapshot, server registration/idempotency.
- Receipt reprint: `pos.receipt.reprint`, reason + actor + sequence audit, original snapshot only.
- Customer Display: read-only server projection, `pos.view`, no admin/user/permission secrets, no write authority, external display refresh every 2 seconds.
- CI regression guard: `npm run test:batch5` is mandatory in Verify before Typecheck/Build.

Batch 5 migrations:
- `20260905163626_pos_table_transfer_and_merge_contract`
- `20260905164017_order_table_actions_table_indexes`
- `20260905164257_receipt_first_print_and_reprint_contract`
- `20260905164722_customer_display_read_only_projection`
- `20260905165322_harden_return_refund_table_grants`
- `20260905165401_harden_split_bill_table_grants`

Batch 5 security regression findings fixed:
- Return/Refund tables had broad authenticated table grants despite SELECT-only RLS; hardened to SELECT only.
- Split Bill tables had the same broad grants; hardened to SELECT only.
- Payments, allocations, discounts, void audit, return/refund, split, table actions and receipt tables now expose SELECT-only table privileges to authenticated clients; writes stay behind RPC contracts.
- Private operational internal functions remain non-executable by `authenticated`; public wrappers remain executable and permission-check server-side.

DB contract audit on locked project:
- Required fine-grained Batch 5/POS permissions: 15 / 15 ✅
- Required public operational RPCs: 13 / 13 ✅
- Required Batch 5 audit/return/receipt tables: RLS enabled ✅
- Sensitive operational tables audited: authenticated grants SELECT-only ✅
- Security Advisor: only Supabase Auth leaked-password-protection warning remains.
- Performance Advisor: no missing-FK regression; remaining notices are fresh-DB `unused_index` INFO.

Verification:
- Table Transfer/Merge #151 ✅
- Receipt/Reprint #163 ✅
- Customer Display #175 ✅
- Final Batch 5 regression Verify #189 ✅ — Batch 5 regression / Typecheck / Build / GitHub Pages Deploy all green.

Known deferred UX boundary:
- Closed-order historical receipt discovery will live in Batch 8 centralized Printing/Receipt history; backend reprint already supports closed orders.

---

## Batch 6 — Procurement & Stock Control 🚧 CURRENT

Execution order:
1. Suppliers 🚧 NEXT
2. Purchase documents + lines ⏳
3. Purchase receive -> warehouse inventory atomically ⏳
4. Purchase workflow + cost history ⏳
5. Formal waste documents ⏳
6. Stock count sessions + variance ⏳
7. Approval center for sensitive inventory operations ⏳
8. Batch 6 regression + Advisors + Verify ⏳

Procurement/stock rules:
- Every supplier/purchase document is branch-scoped.
- Warehouse receipt must reference a real branch warehouse and real inventory items.
- Purchase receipt writes the existing inventory ledger atomically; no direct balance edits.
- Receiving must be idempotent and cannot double-receive the same quantity.
- Purchase lifecycle is explicit; no hidden status side effects.
- Cost history derives from accepted purchase receipts, not UI state.
- Waste/count documents use real warehouse + item references and server-authoritative movements.
- Sensitive adjustments/count variances require granular permissions and later approval contract.
- No self-approval unless an explicit permission is defined.

Immediate target: **Supplier foundation + permissions + RLS + UI contract**.

## Batch 7 — Accounting & Treasury ⏳ QUEUED
COA → journals/lines → expenses → cash/bank treasury → source links → idempotent posting → Trial Balance/Ledger/Income Statement/Balance Sheet/AR/AP aging.

## Batch 8 — Reports & Central Printing ⏳ QUEUED
One table-first reports page with filters/totals/custom columns/Excel/print. Central Kitchen/Receipt history/Shift close/Day close/Report printing.

## Batch 9 — Administration, Offline & Final UX ⏳ QUEUED
Branches/warehouses/users/effective permissions/settings/guided setup; offline critical close/printing; RTL/LTR/mobile/collapsible/touch/final glass UX.

## Batch 10 — Full Verification & Release Candidate ⏳ QUEUED
Typecheck, Build, Unit, DB contract, RLS/permission, Integration, E2E, Advisors, cross-branch denial, offline retry and release candidate.

---

# Current checkpoint

- Locked database: `scpovyrqmsbiduanykod` ✅
- Repository: `Premieros/pos.v2` ✅
- Branch: `development` ✅
- Verified implementation HEAD before this log update: `25c72f54b65c072eed3d4786d3a75afda1dc63db`.
- Final Batch 5 Verify #189: ✅ regression / Typecheck / Build / Pages Deploy.
- Batches 1–5: ✅ CLOSED.
- Batch 6: 🚧 CURRENT.
- Immediate target: **Suppliers**.
- `main` remains untouched.

# Security / Hardening backlog

- Enable Supabase Auth leaked-password protection before release: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Review unused-index INFO after realistic workload; do not delete useful indexes merely to silence the linter.
- Keep service/database credentials outside client and repository history.

# Final release gate

No merge `development` -> `main` until Batches 6–10 are ✅, security hardening is ✅, no known P0/P1 regression remains, and explicit release approval is given.
