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

### 7.1 Chart of Accounts ✅
- Branch-scoped account hierarchy.
- Permissions: `accounting.coa.view/manage`.
- Migration: `20260905183814_chart_of_accounts_foundation`.
- Verify #305 ✅.

### 7.2 Journal Entries + Balanced Lines ✅
- Branch-scoped draft/posted journals and lines.
- Permissions: `accounting.journals.view/create/edit/post`.
- Posting requires at least two lines and exact debit = credit > 0.
- Tables SELECT-only to authenticated; mutations RPC-only.
- Migration: `20260905184225_journal_entries_and_balanced_lines`.
- Verify #317 ✅.

### 7.3 Expenses + Source-linked Posting ✅
- Branch-scoped expense documents.
- Permissions: `accounting.expenses.view/create/edit/post`.
- Expense account must be active/postable expense account; offset account must be same-branch active/postable.
- Expense create is idempotent and branch numbering is serialized.
- Posting is atomic and creates exactly one balanced posted journal with `source_type='expense'` and exact source id lineage.
- Debit = expense account, credit = offset account.
- Posted expense cannot be silently edited under current RPC contract; reversal is deferred to 7.6.
- Expense table is SELECT-only to authenticated; mutations are RPC-only.
- Private expense RPCs are non-executable by authenticated clients.
- Migration: `20260905184632_expenses_and_source_linked_posting`.
- Security Advisor: only existing leaked-password Auth warning.
- Performance Advisor: no expense-specific WARN; fresh-DB unused-index INFO only.
- Verify #329 ✅ — Batch 5 regression / Batch 6 regression / Typecheck / Build / Pages Deploy.

### 7.4 Cash/Bank Treasury Accounts + Movements 🚧 NEXT
- Treasury accounts are branch-scoped and linked to active postable `asset` COA accounts.
- Types: cash / bank.
- Treasury balance is ledger-derived; no editable balance column.
- Treasury movement must retain treasury-account and accounting-journal lineage.
- A manual treasury in/out movement must create one balanced journal atomically against a counter-account.
- Treasury remains separate from POS cashier drawer operational balance.
- Direct table writes remain blocked.

### 7.5 Automatic Operational Source Links ⏳
### 7.6 Idempotent Posting + Reversal Rules ⏳
### 7.7 Accounting Statements Contracts ⏳
### 7.8 Batch 7 Regression + Advisors + Verify ⏳

Accounting rules:
- Branch-scoped accounting records unless an explicit global accounting object is defined.
- Posted journals are immutable; corrections use reversal, never silent edits.
- Every journal must balance debit = credit server-side before posting.
- Source posting is idempotent and retains source lineage.
- Treasury movements preserve cash/bank account lineage and branch isolation.
- Permissions remain granular and permission-first.

Immediate target: **7.4 Cash/Bank Treasury Accounts + Movements**.

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
- Batch 7.1–7.3: ✅ CLOSED.
- Immediate target: **7.4 Cash/Bank Treasury Accounts + Movements**.
- Verified implementation HEAD before this log update: `5f221bd23c9037159067778030061d5cc46afbd4`.
- `main` untouched.

## Hardening backlog
- Enable Supabase Auth leaked-password protection before release: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Review unused-index INFO only after realistic workload.
- Keep credentials outside client/repository history.

## Final release gate
No `development` → `main` merge until Batches 7–10 are ✅, security hardening is ✅, no known P0/P1 regression remains, and explicit release approval is given.
