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

## Batch 8 — Reports & Central Printing 🚧 CURRENT

### 8.1 Unified Reports Contract ✅
- One professional table-first Reports workspace, not duplicated report icons/pages.
- Permission-first with `reports.view`, branch-scoped server-side access assertion and no role-label checks.
- Shared filters: date range, payment method, employee, product and order type.
- Product and employee options come from the real authorized branch through a dedicated read-only RPC.
- No charts and no fake report rows; report bodies remain explicit future contracts until 8.2–8.4.
- Responsive RTL-first report selector/result workspace integrated into the app shell under `التقارير`.
- Migration: `20260905192644_unified_reports_foundation`.
- Security Advisor: only the known leaked-password-protection Auth warning.
- Performance Advisor: no report-specific material finding; fresh-DB unused-index INFO only.
- Live audit: `reports.view` exists; private report functions are non-executable by authenticated; public filter RPC is executable.
- Verify #411 ✅ — Batch 5/6/7 regression, Typecheck, Build and Pages Deploy.

### 8.2 Sales & Operations Reports 🚧 NEXT
- Sales summary / detailed invoices.
- Sales by payment / employee / product / order type.
- Returns/refunds/voids/discounts.
- Cashier and shift performance.
- All projections remain read-only, branch-scoped and consume the unified filter contract.

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

Immediate target: **8.2 Sales & Operations Reports**.

## Batch 9 — Administration, Offline & Final UX ⏳ QUEUED
Branches/warehouses/users/effective permissions/settings/guided setup, offline critical close/printing, RTL/LTR/mobile/collapsible/touch/final glass UX.

## Batch 10 — Full Verification & Release Candidate ⏳ QUEUED
Typecheck, Build, Unit/contract tests, RLS/permission tests, Integration/E2E, cross-branch denial, offline retry, Advisors and release candidate.

## Current checkpoint
- Database: `scpovyrqmsbiduanykod` ✅
- Repository: `Premieros/pos.v2` ✅
- Branch: `development` ✅
- Batches 1–7: ✅ CLOSED.
- Batch 8.1: ✅ CLOSED — Verify #411.
- Immediate target: **8.2 Sales & Operations Reports**.
- Verified implementation HEAD before this log update: `adf02788244098bd460210501d4623899587e6b3`.
- `main` untouched.

## Hardening backlog
- Enable Supabase Auth leaked-password protection before release: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Review unused-index INFO only after realistic workload.
- Keep credentials outside client/repository history.

## Final release gate
No `development` → `main` merge until Batches 8–10 are ✅, security hardening is ✅, no known P0/P1 regression remains, and explicit release approval is given.
