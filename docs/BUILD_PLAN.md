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

## Batch 6 — Procurement & Stock Control
- 6.1 Suppliers ✅ — Verify #201
- 6.2 Purchase Documents + Lines ✅ — Verify #219
- 6.3 Purchase Receive → Inventory ✅ — Verify #233
- 6.4 Purchase Workflow + Cost History ✅ — Verify #245
- 6.5 Formal Waste Documents ✅ — Verify #259

### 6.6 Stock Count Sessions + Variance ✅
- Branch/warehouse-scoped count sessions and real inventory-item lines.
- System quantity snapshot is captured server-side when an item is counted.
- Counted quantity must be zero or positive.
- Variance is generated server-side as `counted_quantity - system_quantity`.
- Re-count refreshes the snapshot and actual quantity atomically.
- Submit requires at least one line and fails closed if stock changed since any snapshot.
- Submit freezes the session as `pending_approval`.
- No stock movement or balance change occurs in 6.6.
- Count-only users receive read-only warehouse/item references without setup/mutation rights.
- Count tables are SELECT-only to authenticated; all writes are RPC-only.
- Private count RPCs are not executable by authenticated clients.
- Migration: `20260905181306_stock_count_sessions_and_variance`.
- Security Advisor: only existing leaked-password Auth warning.
- Performance Advisor: no count-specific WARN; fresh-DB unused-index INFO only.
- Verify #271 ✅ — Batch 5 regression / Typecheck / Build / Pages Deploy.

### 6.7 Approval Center 🚧 NEXT
- Independent approval permissions.
- No self-approval unless explicit self-review permission exists.
- Approved count variance posts `count_adjustment` movements atomically.
- Rejected counts never affect stock.
- Reviewer must see exact branch/warehouse/item variance context.

### 6.8 Batch 6 Regression + Advisors + Verify ⏳

## Current checkpoint
- Database: `scpovyrqmsbiduanykod` ✅
- Repository: `Premieros/pos.v2` ✅
- Branch: `development` ✅
- Verified implementation HEAD: `48cb39226aeed66dd99f943a46f1dfbbf5405beb`.
- Batch 6.1–6.6 ✅
- Immediate target: **6.7 Approval Center**.
- `main` untouched.

## Remaining after Batch 6
- Batch 7 — Accounting & Treasury.
- Batch 8 — Reports & Central Printing.
- Batch 9 — Administration, Offline & Final UX.
- Batch 10 — Full Verification & Release Candidate.

## Hardening backlog
- Enable Supabase Auth leaked-password protection before release.
- Review unused-index INFO only after realistic workload.
- Keep credentials outside client/repository history.

## Final release gate
No `development` → `main` merge until Batches 6–10 are ✅, security hardening is ✅, no known P0/P1 regression remains, and explicit release approval is given.
