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
- Independent `procurement.purchases.submit` / `procurement.purchases.cancel`.
- Submit requires at least one line.
- Cancel requires reason and is blocked after receipt history.
- Receiving requires submitted/partially_received.
- Status transitions are audited.
- Cost history derives from accepted receipt lines only via `security_invoker` view.
- Migration: `20260905173904_purchase_workflow_and_cost_history`.
- Verify #245 ✅.

### 6.5 Formal Waste Documents ✅
- Formal `waste_documents` + `waste_document_lines` with real branch warehouse/item references.
- `inventory.waste` remains the only functional permission for the workspace and commands.
- Authenticated table access is SELECT-only; mutations are RPC-only.
- Private functions are non-executable by authenticated clients.
- Posting is idempotent and writes the existing `stock_movements` ledger using `movement_type='waste'`.
- Insufficient stock fails closed; balances are never directly edited.
- Waste line preserves exact stock movement reference.
- RLS init-plan warning fixed forward-only.
- Migrations:
  - `20260905175458_formal_waste_documents`
  - `20260905175540_waste_rls_initplan_hardening`
- Security Advisor: only existing leaked-password Auth warning.
- Performance Advisor: no waste-specific WARN after hardening; fresh-DB unused-index INFO only.
- Verify #259 ✅ — Batch 5 regression / Typecheck / Build / Pages Deploy.

### 6.6 Stock Count Sessions + Variance 🚧 NEXT
- Count sessions are branch + warehouse scoped.
- Actual quantities and system snapshots are recorded per inventory item.
- Variance is server-derived.
- Submission freezes the count for review.
- 6.6 must not post stock adjustment before Approval Center 6.7.

### 6.7 Approval Center ⏳
### 6.8 Batch 6 Regression + Advisors + Verify ⏳

## Current checkpoint
- Database: `scpovyrqmsbiduanykod` ✅
- Repository: `Premieros/pos.v2` ✅
- Branch: `development` ✅
- Verified implementation HEAD: `c1a353b718562a26cf136eaeb398a4d58924b167`.
- Batch 6.1–6.5 ✅
- Immediate target: **6.6 Stock Count Sessions + Variance**.
- `main` untouched.

## Hardening backlog
- Enable Supabase Auth leaked-password protection before release.
- Review unused-index INFO only after realistic workload.
- Keep credentials outside client/repository history.

## Final release gate
No `development` → `main` merge until Batches 6–10 are ✅, security hardening is ✅, no known P0/P1 regression remains, and explicit release approval is given.
