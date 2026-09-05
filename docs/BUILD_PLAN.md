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
- Table Transfer / Merge with atomic server contracts and no revenue duplication.
- Receipt first-print / Reprint with immutable authoritative snapshot and separate permissions.
- Read-only Customer Display projection/window.
- Batch 5 CI regression guard before Typecheck/Build.
- Return/Refund and Split Bill direct table grants hardened to SELECT-only.

Verification:
- Transfer/Merge #151 ✅
- Receipt/Reprint #163 ✅
- Customer Display #175 ✅
- Final Batch 5 #189 ✅
- DB audit: 15/15 required permissions, 13/13 required RPCs, RLS on required tables, sensitive operational tables SELECT-only for authenticated.
- Security Advisor: only leaked-password-protection Auth warning remains.
- Performance: no missing-FK regression; fresh-DB unused-index INFO only.

---

## Batch 6 — Procurement & Stock Control 🚧 CURRENT

### 6.1 Suppliers ✅

Completed contract:
- New permissions: `procurement.view` and `procurement.suppliers.manage`.
- Suppliers are branch-scoped with unique supplier code per branch and optional unique tax number per branch.
- RLS SELECT requires accessible branch plus procurement view/manage permission.
- `authenticated` has SELECT-only table access; create/update are RPC-only.
- `create_supplier` and `update_supplier` are server-authoritative; private internals are not executable by authenticated clients.
- Supplier audit fields track creator/updater and timestamps.
- Permission-aware Supplier workspace added to the RTL sidebar.
- UI supports create, list, activate/deactivate; no role-name checks and no direct writes.

Migration:
- `20260905165620_supplier_foundation`

Verification:
- Security Advisor: no Supplier-specific security issue; existing Auth warning only.
- Performance Advisor: no missing-FK warning; Supplier notices are unused-index INFO on fresh DB.
- Verify #201 ✅ — Batch 5 regression / Typecheck / Build / GitHub Pages Deploy all green.

### 6.2 Purchase documents + lines ✅

Completed contract:
- Branch-scoped `purchase_orders` header linked to a real branch supplier.
- Real `purchase_order_lines` linked to branch-scoped `inventory_items` through composite branch FKs.
- Explicit lifecycle values: `draft`, `submitted`, `partially_received`, `received`, `cancelled`.
- Server-calculated line totals and purchase totals.
- Draft-only line add/update/remove commands.
- Fine-grained `procurement.purchases.view/create/edit/receive` permissions.
- Purchase header creation is idempotent per branch.
- Purchase numbering is branch-local and allocated server-side under advisory transaction lock.
- `authenticated` has SELECT-only table grants; all mutations stay behind public RPC wrappers and private non-executable internals.
- Purchase users receive read-only supplier and inventory-item reference access without supplier-management or inventory-mutation authority.
- Reference SELECT policies were merged into the existing policies after Performance Advisor detected duplicate permissive policies.
- Permission-aware Purchase workspace added to the sidebar with create/list/select/add/edit/remove draft lines and guided missing-reference messages.

Migrations:
- `20260905165954_purchase_documents_and_lines`
- `20260905172328_purchase_reference_read_policies`
- `20260905172555_merge_purchase_reference_select_policies`

Verification:
- Security Advisor: no purchase-specific security issue; only the existing leaked-password Auth warning remains.
- Performance Advisor: duplicate permissive policies fixed; remaining notices are expected fresh-DB `unused_index` INFO.
- Private purchase internals are not executable by `authenticated`; public purchase wrappers are executable and permission-check server-side.
- Verify #217 exposed only a TypeScript branch-id narrowing issue; no backend regression.
- Verify #219 ✅ — Batch 5 regression / Typecheck / Build / GitHub Pages Deploy all green.

### 6.3 Purchase receive -> warehouse inventory atomically 🚧 NEXT
- Real branch warehouse + inventory items.
- Idempotent receiving and cumulative quantity protection.
- Existing `stock_movements` ledger only; never direct balance edits.
- Partial receipt must update `received_quantity` and derive purchase status atomically.
- Cross-branch warehouse/item references must fail closed.

### 6.4 Purchase workflow + cost history ⏳
- Explicit statuses and accepted-receipt-derived cost history.

### 6.5 Formal waste documents ⏳
### 6.6 Stock count sessions + variance ⏳
### 6.7 Approval center ⏳
### 6.8 Batch 6 regression + Advisors + Verify ⏳

Procurement/stock rules:
- Every supplier/purchase document is branch-scoped.
- Warehouse receipt must reference real branch warehouse and inventory items.
- Receiving is idempotent and cannot double-receive quantities.
- Purchase lifecycle is explicit; no hidden status side effects.
- Cost history derives from accepted receipts.
- Waste/counts use real warehouse/item references and server-authoritative movements.
- Sensitive variance/adjustment operations require granular permissions and approval contracts.
- No self-approval unless explicit permission is defined.

Immediate target: **Purchase receive -> warehouse inventory atomically**.

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
- Verified implementation HEAD before this log update: `dd6e9d928a0ebbcd4f6069fad0460d3f16a29a28`.
- Purchase Documents Verify #219: ✅ regression / Typecheck / Build / Pages Deploy.
- Batches 1–5: ✅ CLOSED.
- Batch 6: 🚧 CURRENT.
- Suppliers: ✅ CLOSED.
- Purchase documents + lines: ✅ CLOSED.
- Immediate target: **Purchase receive -> warehouse inventory atomically**.
- `main` remains untouched.

# Security / Hardening backlog

- Enable Supabase Auth leaked-password protection before release: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Review unused-index INFO after realistic workload; do not delete useful indexes merely to silence the linter.
- Keep service/database credentials outside client and repository history.

# Final release gate

No merge `development` -> `main` until Batches 6–10 are ✅, security hardening is ✅, no known P0/P1 regression remains, and explicit release approval is given.
