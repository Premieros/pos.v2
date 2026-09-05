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

## Batch 7 — Accounting & Treasury 🚧 CURRENT

### 7.1 Chart of Accounts ✅
- Branch-scoped `accounts` hierarchy with unique branch account codes.
- Types: asset / liability / equity / revenue / expense.
- Normal balance is server-derived from account type.
- Parent and child must remain in the same branch and account type.
- Postable accounts cannot be used as parents; hierarchy cycles are rejected.
- Permissions: `accounting.coa.view` / `accounting.coa.manage`.
- Authenticated table access is SELECT-only; mutations are RPC-only.
- Private create/update RPCs are not executable by authenticated clients.
- Migration: `20260905183814_chart_of_accounts_foundation`.
- Security Advisor: only existing leaked-password Auth warning.
- Performance Advisor: no accounting-specific WARN; fresh-DB unused-index INFO only.
- Verify #305 ✅ — Batch 5 regression / Batch 6 regression / Typecheck / Build / Pages Deploy.

### 7.2 Journal Entries + Balanced Lines 🚧 NEXT
- Branch-scoped draft/posted journal entries.
- Draft lines reference active postable accounts in the same branch.
- Debit/credit values are server-validated.
- Posting is blocked unless total debit equals total credit and is greater than zero.
- Posted entries become immutable; reversal is deferred to 7.6.
- Direct authenticated writes remain blocked.

### 7.3 Expenses + Source-linked Posting ⏳
### 7.4 Cash/Bank Treasury Accounts + Movements ⏳
### 7.5 Automatic Operational Source Links ⏳
### 7.6 Idempotent Posting + Reversal Rules ⏳
### 7.7 Accounting Statements Contracts ⏳
### 7.8 Batch 7 Regression + Advisors + Verify ⏳

Accounting rules:
- Branch-scoped accounting records unless an explicit global accounting object is defined.
- Posted journals are immutable; corrections use reversal, never silent edits.
- Every journal must balance debit = credit server-side before posting.
- No direct frontend journal-line writes for posted entries.
- Source posting must be idempotent and retain source lineage.
- Treasury movements must preserve cash/bank account lineage and branch isolation.
- Permissions remain granular and permission-first.

Immediate target: **7.2 Journal Entries + Balanced Lines**.

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
- Batch 7.1: ✅ CLOSED.
- Immediate target: **7.2 Journal Entries + Balanced Lines**.
- Verified implementation HEAD before this log update: `4c68817eced4795c87eebe53ea7763fde64925ea`.
- `main` untouched.

## Hardening backlog
- Enable Supabase Auth leaked-password protection before release: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Review unused-index INFO only after realistic workload.
- Keep credentials outside client/repository history.

## Final release gate
No `development` → `main` merge until Batches 7–10 are ✅, security hardening is ✅, no known P0/P1 regression remains, and explicit release approval is given.
