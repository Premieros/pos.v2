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

## Batch 7 — Accounting & Treasury 🚧 CURRENT
- 7.1 Chart of Accounts ✅ — Verify #305
- 7.2 Journal Entries + Balanced Lines ✅ — Verify #317
- 7.3 Expenses + Source-linked Posting ✅ — Verify #329

### 7.4 Cash/Bank Treasury Accounts + Movements ✅
- Branch-scoped cash/bank treasury accounts linked one-to-one to active postable asset COA accounts.
- Permissions: `treasury.view`, `treasury.accounts.manage`, `treasury.movements.create`.
- Ledger-derived `treasury_balances` view uses `security_invoker=true`; no editable balance column.
- Manual treasury movement is idempotent and creates one balanced posted journal atomically with exact movement lineage.
- Incoming: debit treasury asset / credit counter account. Outgoing: debit counter / credit treasury asset.
- Outgoing movement cannot exceed ledger-derived balance.
- Concurrent outgoing movements are serialized by locking the treasury account before balance validation.
- Treasury remains separate from POS cashier drawer operational balances.
- Treasury tables are SELECT-only to authenticated; mutations are RPC-only; private RPCs are non-executable.
- Migrations: `20260905185108_treasury_accounts_and_movements`, `20260905185128_treasury_movement_concurrency_hardening`.
- Security Advisor: only existing leaked-password Auth warning.
- Performance Advisor: no treasury-specific WARN; fresh-DB unused-index INFO only.
- Verify #343 ✅ — Batch 5 regression / Batch 6 regression / Typecheck / Build / Pages Deploy.

### 7.5 Automatic Operational Source Links 🚧 NEXT
- Branch accounting mappings define which COA accounts receive operational postings.
- Closed/paid POS sales post from real payment composition, not role/UI assumptions.
- Accepted purchase receipts post from actual accepted receipt quantities and stored receipt cost.
- Every source is idempotent and keeps exact `source_type/source_id` journal lineage.
- Source posting never modifies the operational document itself except through explicitly designed linkage if required.
- Missing accounting mapping fails closed with a guided configuration prerequisite.

### 7.6 Idempotent Posting + Reversal Rules ⏳
### 7.7 Accounting Statements Contracts ⏳
### 7.8 Batch 7 Regression + Advisors + Verify ⏳

Accounting rules:
- Posted journals are immutable; corrections use reversal, never silent edits.
- Every journal balances server-side.
- Source posting is idempotent and preserves lineage.
- Permissions remain granular and permission-first.

Immediate target: **7.5 Automatic Operational Source Links**.

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
- Batch 7.1–7.4: ✅ CLOSED.
- Immediate target: **7.5 Automatic Operational Source Links**.
- Verified implementation HEAD before this log update: `e5a6702ce9f369d9ebd614ff65ba0015f56c0b22`.
- `main` untouched.

## Hardening backlog
- Enable Supabase Auth leaked-password protection before release: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Review unused-index INFO only after realistic workload.
- Keep credentials outside client/repository history.

## Final release gate
No `development` → `main` merge until Batches 7–10 are ✅, security hardening is ✅, no known P0/P1 regression remains, and explicit release approval is given.
