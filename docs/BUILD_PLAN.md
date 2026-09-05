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
- Reference reads do not grant management/mutation rights.
- Duplicate permissive reference policies were merged after Advisor review.
- Migrations:
  - `20260905165954_purchase_documents_and_lines`
  - `20260905172328_purchase_reference_read_policies`
  - `20260905172555_merge_purchase_reference_select_policies`
- Verify #219 ✅.

### 6.3 Purchase Receive → Warehouse Inventory ✅
- Real active same-branch warehouse mandatory.
- `procurement.purchases.receive` independent from manual `inventory.receive`.
- Partial receipts supported and cumulative quantity protected.
- Accepted quantities write the existing `stock_movements` ledger atomically.
- Receipt history preserves exact stock-movement lineage.
- Receipt tables SELECT-only; mutation RPC-only.
- Composite branch FKs enforce receipt lineage.
- Migrations:
  - `20260905173029_purchase_atomic_receiving`
  - `20260905173238_purchase_receipt_lineage_and_indexes`
  - `20260905173541_purchase_receipt_order_line_covering_index`
- Verify #233 ✅.

### 6.4 Purchase Workflow + Cost History ✅
- New independent permissions: `procurement.purchases.submit` / `procurement.purchases.cancel`.
- Draft must contain at least one line before Submit.
- Cancel is limited to draft/submitted, requires a reason, and is blocked once receipt history exists.
- Receiving now requires submitted/partially_received state.
- Every explicit/derived status transition is audited in `purchase_order_status_events`.
- Status event table is SELECT-only to authenticated; private workflow RPCs are non-executable by authenticated clients.
- Cost history view `inventory_item_purchase_cost_history` is `security_invoker=true` and derives only from accepted receipt lines.
- Historical accepted receipt cost is not rewritten by later purchase state changes.
- Migration: `20260905173904_purchase_workflow_and_cost_history`.
- Security Advisor: only existing leaked-password Auth warning.
- Performance Advisor: no phase-specific structural warning; fresh-DB unused-index INFO only.
- Verify #245 ✅ — Batch 5 regression / Typecheck / Build / Pages Deploy.

### 6.5 Formal Waste Documents 🚧 NEXT
- Real branch warehouse + inventory item references.
- Formal header/lines/audit instead of standalone movement UI.
- Accepted waste must write existing stock ledger atomically and never directly edit balances.
- `inventory.waste` remains independent.

### 6.6 Stock Count Sessions + Variance ⏳
### 6.7 Approval Center ⏳
### 6.8 Batch 6 Regression + Advisors + Verify ⏳

## Current checkpoint
- Database: `scpovyrqmsbiduanykod` ✅
- Repository: `Premieros/pos.v2` ✅
- Branch: `development` ✅
- Verified implementation HEAD before this log update: `544e1157d12f487d9558a22e83f7cc94f324a4d9`.
- Batch 6.1–6.4 ✅
- Immediate target: **6.5 Formal Waste Documents**.
- `main` untouched.

## Hardening backlog
- Enable Supabase Auth leaked-password protection before release.
- Review unused-index INFO only after realistic workload.
- Keep credentials outside client/repository history.

## Final release gate
No `development` → `main` merge until Batches 6–10 are ✅, security hardening is ✅, no known P0/P1 regression remains, and explicit release approval is given.
