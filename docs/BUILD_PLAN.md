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
- Batch 7 — Accounting & Treasury ✅ CLOSED
- Batch 8 — Reports & Central Printing 🚧 CURRENT
- Batch 9 — Administration, Offline & Final UX ⏳ QUEUED
- Batch 10 — Full Verification & Release Candidate ⏳ QUEUED

## Batch 7 — Accounting & Treasury ✅ CLOSED
- 7.1 Chart of Accounts ✅ — Verify #305
- 7.2 Journal Entries + Balanced Lines ✅ — Verify #317
- 7.3 Expenses + Source-linked Posting ✅ — Verify #329
- 7.4 Cash/Bank Treasury Accounts + Movements ✅ — Verify #343
- 7.5 Automatic Operational Source Links ✅ — Verify #361
- 7.6 Idempotent Posting + Reversal Rules ✅ — Verify #371
- 7.7 Accounting Statements Contracts ✅ — Verify #391
- 7.8 Batch 7 Regression + Advisors + Verify ✅ — Verify #399

### Batch 7 closure contract
- COA is branch-scoped and permission-first.
- Journal posting is server-balanced and posted journals remain immutable.
- Expense posting creates exact source-linked balanced journals.
- Treasury cash/bank accounts are separate from POS cashier drawer balances and derive balances from immutable movements.
- POS sales and purchase receipts create idempotent accounting source postings when mapping is configured; missing setup remains visible in a retryable queue without breaking operational flow.
- Refunds create dedicated reverse-effect accounting journals; original sale journals are not mutated.
- Posted journal correction uses a separate reversal journal with swapped debit/credit, reason, idempotency and explicit original/reversal lineage.
- Accounting statements are read-only from posted journals: Trial Balance, General Ledger, Income Statement and Balance Sheet.
- Statement-only users obtain account references through a dedicated statement permission and do not require COA management permission.
- Authenticated direct table grants for sensitive Batch 7 tables are SELECT-only.
- Live DB audit: 18/18 required Batch 7 permissions present; sensitive accounting tables audited SELECT-only; matching `app_private` accounting/treasury/statement functions executable by authenticated = 0.
- Security Advisor: only the known Supabase Auth leaked-password-protection warning remains.
- Performance Advisor: no material Batch 7 issue; fresh-database unused-index INFO only.
- Repository regression guards: Batch 5 ✅ / Batch 6 ✅ / Batch 7 ✅.

## Batch 8 — Reports & Central Printing 🚧 CURRENT

### 8.1 Unified Reports Contract 🚧 NEXT
- One professional table-first Reports workspace, not duplicated report icons/pages.
- Permission-first, branch-scoped and server-authoritative data projections.
- Filters: branch scope, date range, payment method, employee, product, order type and relevant source-specific filters.
- Totals and clear empty/loading/error/unauthorized states.
- No charts in the canonical reports workspace.

### 8.2 Sales & Operations Reports ⏳
- Sales summary / detailed invoices.
- Sales by payment / employee / product / order type.
- Returns/refunds/voids/discounts.
- Cashier and shift performance.

### 8.3 Procurement, Inventory & Cost Reports ⏳
- Purchases and suppliers.
- Inventory balances/movements.
- Component consumption / stock alerts / counts / waste.
- Purchase cost history and relevant cost projections.

### 8.4 Accounting Reports Integration ⏳
- Integrate Trial Balance, General Ledger, Income Statement and Balance Sheet into the central reports experience without duplicating accounting contracts.

### 8.5 Custom Columns + Excel Export ⏳
- User-selectable report columns.
- Excel export based on the same filtered result and totals.

### 8.6 Central Printing ⏳
- Centralized print workflows for Kitchen, receipts/reprints, shift close, day close and reports.
- Permission-aware reprint behavior; receipt immutable snapshot contract remains authoritative.

### 8.7 Batch 8 Regression + Advisors + Verify ⏳

Immediate target: **8.1 Unified Reports Contract**.

## Batch 9 — Administration, Offline & Final UX ⏳ QUEUED
Branches/warehouses/users/effective permissions/settings/guided setup, offline critical close/printing, RTL/LTR/mobile/collapsible/touch/final glass UX.

## Batch 10 — Full Verification & Release Candidate ⏳ QUEUED
Typecheck, Build, Unit/contract tests, RLS/permission tests, Integration/E2E, cross-branch denial, offline retry, Advisors and release candidate.

## Current checkpoint
- Database: `scpovyrqmsbiduanykod` ✅
- Repository: `Premieros/pos.v2` ✅
- Branch: `development` ✅
- Batches 1–7: ✅ CLOSED.
- Immediate target: **8.1 Unified Reports Contract**.
- Verified Batch 7 implementation HEAD before this log update: `fefc1b8fa9f331b0483bdba0b160738a9b254203` — Verify #399 ✅.
- `main` untouched.

## Hardening backlog
- Enable Supabase Auth leaked-password protection before release: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Review unused-index INFO only after realistic workload.
- Keep credentials outside client/repository history.

## Final release gate
No `development` → `main` merge until Batches 8–10 are ✅, security hardening is ✅, no known P0/P1 regression remains, and explicit release approval is given.
