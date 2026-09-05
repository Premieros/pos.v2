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
- Batch 6 — Procurement & Stock Control ✅ CLOSED
- Batch 7 — Accounting & Treasury 🚧 CURRENT
- Batch 8 — Reports & Central Printing ⏳ QUEUED
- Batch 9 — Administration, Offline & Final UX ⏳ QUEUED
- Batch 10 — Full Verification & Release Candidate ⏳ QUEUED

## Batch 6 — Procurement & Stock Control ✅ CLOSED
- 6.1 Suppliers ✅ — Verify #201
- 6.2 Purchase Documents + Lines ✅ — Verify #219
- 6.3 Purchase Receive → Inventory ✅ — Verify #233
- 6.4 Purchase Workflow + Cost History ✅ — Verify #245
- 6.5 Formal Waste Documents ✅ — Verify #259
- 6.6 Stock Count Sessions + Variance ✅ — Verify #271
- 6.7 Approval Center ✅ — Verify #283
- 6.8 Final Batch 6 Regression / Advisors / Audit ✅ — Verify #293

Batch 6 closing evidence:
- Required procurement/inventory/approval permissions: 13/13 present.
- RLS enabled on suppliers, purchase headers/lines/receipts, waste docs/lines, stock-count sessions/lines and approval requests.
- Authenticated grants on those sensitive tables are SELECT-only; writes remain RPC-only.
- Approval center uses `approvals.view`, `approvals.review`, and explicit `approvals.self_review`.
- Self-approval is denied by default.
- Approved count variance writes idempotent `count_adjustment` movements atomically; rejected requests do not touch stock.
- Waste and count flows use the existing stock ledger; balances are never directly edited.
- Applied Waste RLS migration is represented exactly as `20260905175537_waste_rls_initplan_hardening` in repository and database.
- Batch 6 repository regression guard is mandatory in Verify after Batch 5 regression.
- Security Advisor: only the existing Auth leaked-password-protection warning remains.
- Performance Advisor: no structural WARN; fresh-DB `unused_index` INFO only.
- Verify #293 ✅ — Batch 5 regression / Batch 6 regression / Typecheck / Build / GitHub Pages Deploy.
- Verified implementation HEAD before this log update: `bbf880fba0d460d3722a00fbc6c87c34db85277f`.

## Batch 7 — Accounting & Treasury 🚧 CURRENT
Planned order:
- 7.1 Chart of Accounts foundation.
- 7.2 Journal entries + balanced journal lines.
- 7.3 Expenses and source-linked posting.
- 7.4 Cash/Bank treasury accounts and movements.
- 7.5 Automatic source links from operational modules where contractually valid.
- 7.6 Idempotent posting / reversal rules.
- 7.7 Accounting statements contracts: Trial Balance, Ledger, Income Statement, Balance Sheet, AR/AP aging foundations.
- 7.8 Batch 7 regression + Advisors + Verify.

Accounting rules:
- Branch-scoped accounting records unless an explicit global accounting object is defined.
- Posted journals are immutable; corrections use reversal, never silent edits.
- Every journal must balance debit = credit server-side before posting.
- No direct frontend journal-line writes for posted entries.
- Source posting must be idempotent and retain source lineage.
- Treasury movements must preserve cash/bank account lineage and branch isolation.
- Permissions remain granular and permission-first.

Immediate target: **7.1 Chart of Accounts foundation**.

## Batch 8 — Reports & Central Printing ⏳ QUEUED
One table-first reports page with filters/totals/custom columns/Excel/print, plus centralized Kitchen/Receipt/Shift close/Day close/Report printing.

## Batch 9 — Administration, Offline & Final UX ⏳ QUEUED
Branches/warehouses/users/effective permissions/settings/guided setup, offline critical close/printing, RTL/LTR/mobile/collapsible/touch/final glass UX.

## Batch 10 — Full Verification & Release Candidate ⏳ QUEUED
Typecheck, Build, Unit/contract tests, RLS/permission tests, Integration/E2E, cross-branch denial, offline retry, Advisors and release candidate.

## Current checkpoint
- Database: `scpovyrqmsbiduanykod` ✅
- Repository: `Premieros/pos.v2` ✅
- Branch: `development` ✅
- Batches 1–6: ✅ CLOSED.
- Batch 7: 🚧 CURRENT.
- Immediate target: **7.1 Chart of Accounts foundation**.
- `main` untouched.

## Hardening backlog
- Enable Supabase Auth leaked-password protection before release: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Review unused-index INFO only after realistic workload.
- Keep credentials outside client/repository history.

## Final release gate
No `development` → `main` merge until Batches 7–10 are ✅, security hardening is ✅, no known P0/P1 regression remains, and explicit release approval is given.
