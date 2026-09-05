# POS.V2 — Canonical Build Plan

Repository: `Premieros/pos.v2`  
Development branch: `development`  
Locked Supabase project: `scpovyrqmsbiduanykod`  
Preview: `https://premieros.github.io/pos.v2/`

## Mandatory rules
- Database identity is locked to `scpovyrqmsbiduanykod`.
- Permission-first; no role-label authorization in feature code.
- Hidden immutable Super Admin remains global.
- Normal users require branch access + effective permission.
- Public business tables use RLS.
- Critical mutations are server-authoritative atomic commands.
- Accepted migrations are forward-only.
- Never weaken RLS/tests to make failures pass.
- Missing prerequisites use guided setup.
- No merge to `main` before final release gate and explicit approval.

## Batch status
- Batch 1 — Platform Foundation ✅ CLOSED
- Batch 2 — Catalog, Inventory & Shift Foundation ✅ CLOSED
- Batch 3 — POS Core, Kitchen & Payments ✅ CLOSED
- Batch 4 — POS Operational Controls I ✅ CLOSED
- Batch 5 — POS Operational Controls II ✅ CLOSED
- Batch 6 — Procurement & Stock Control 🚧 CURRENT
- Batch 7 — Accounting & Treasury ⏳ QUEUED
- Batch 8 — Reports & Central Printing ⏳ QUEUED
- Batch 9 — Administration, Offline & Final UX ⏳ QUEUED
- Batch 10 — Full Verification & Release Candidate ⏳ QUEUED

## Batch 5 verification baseline
- Transfer/Merge #151 ✅
- Receipt/Reprint #163 ✅
- Customer Display #175 ✅
- Final Batch 5 regression #189 ✅
- Batch 5 regression guard remains mandatory in Verify.

## Batch 6 — Procurement & Stock Control

### 6.1 Suppliers ✅
- Branch-scoped suppliers.
- `procurement.view` / `procurement.suppliers.manage`.
- SELECT-only authenticated table access; RPC-only mutations.
- Migration: `20260905165620_supplier_foundation`.
- Verify #201 ✅.

### 6.2 Purchase Documents + Lines ✅
- Branch-scoped purchase headers linked to real suppliers.
- Lines linked to real branch `inventory_items`.
- Server totals; draft-only line edits.
- Permissions: `procurement.purchases.view/create/edit/receive`.
- SELECT-only authenticated table grants; RPC-only mutations.
- Purchase reference reads do not grant supplier-management or inventory-mutation rights.
- Duplicate permissive reference policies were merged after Advisor review.
- Migrations:
  - `20260905165954_purchase_documents_and_lines`
  - `20260905172328_purchase_reference_read_policies`
  - `20260905172555_merge_purchase_reference_select_policies`
- Verify #219 ✅.

### 6.3 Purchase Receive → Warehouse Inventory ✅
- Real active warehouse from the same branch is mandatory.
- `procurement.purchases.receive` is independent from manual `inventory.receive`.
- Partial receipts supported; cumulative quantity cannot exceed ordered quantity.
- Accepted quantities write the existing `stock_movements` ledger in the same transaction.
- `received_quantity` and purchase status update atomically.
- Full receipt → `received`; partial receipt → `partially_received`.
- Receipt history: `purchase_receipts` + `purchase_receipt_lines` with exact stock-movement lineage.
- Receipt tables are SELECT-only to authenticated; mutations are RPC-only.
- Private receive function is not executable by authenticated; public wrapper is.
- Warehouse read visibility extended only for purchase receivers.
- Composite branch FK enforces receipt-line → purchase-line lineage.
- Migrations:
  - `20260905173029_purchase_atomic_receiving`
  - `20260905173238_purchase_receipt_lineage_and_indexes`
  - `20260905173541_purchase_receipt_order_line_covering_index`
- Security Advisor: only existing leaked-password Auth warning.
- Performance Advisor: no missing-FK warning; fresh-DB unused-index INFO only.
- Verify #233 ✅ — regression / Typecheck / Build / Pages Deploy.

### 6.4 Purchase Workflow + Cost History 🚧 NEXT
- Explicit submit/cancel lifecycle commands.
- Accepted receipt-derived cost history.
- Historical receipt cost must never be rewritten by later purchase edits.

### 6.5 Formal Waste Documents ⏳
### 6.6 Stock Count Sessions + Variance ⏳
### 6.7 Approval Center ⏳
### 6.8 Batch 6 Regression + Advisors + Verify ⏳

## Current checkpoint
- Database: `scpovyrqmsbiduanykod` ✅
- Repository: `Premieros/pos.v2` ✅
- Branch: `development` ✅
- Verified implementation HEAD before this log update: `a0a52d24f36f2fdfae76f6ae67e0110655fce6ad`.
- Batch 6.1 ✅
- Batch 6.2 ✅
- Batch 6.3 ✅
- Immediate target: **6.4 Purchase Workflow + Cost History**.
- `main` untouched.

## Hardening backlog
- Enable Supabase Auth leaked-password protection before release.
- Review unused-index INFO only after realistic workload.
- Keep credentials outside client/repository history.

## Final release gate
No `development` → `main` merge until Batches 6–10 are ✅, security hardening is ✅, no known P0/P1 regression remains, and explicit release approval is given.
