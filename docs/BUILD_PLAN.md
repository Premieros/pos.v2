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
- One table-first Reports workspace, `reports.view`, branch-scoped server access and shared date/payment/employee/product/order-type filters.
- No charts or fake rows; responsive RTL-first UI.
- Migration: `20260905192644_unified_reports_foundation`.
- Verify #411 ✅.

### 8.2 Sales & Operations Reports ✅
- Real read-only projections for sales summary, detailed invoices, payment method, employee, product, order type, returns/refunds/voids/discounts and cashier/shift performance.
- Migration: `20260905193209_sales_operations_report_projections`.
- Verify #421 ✅.

### 8.3 Procurement, Inventory & Cost Reports ✅
- Purchases/suppliers, ledger-derived inventory, waste and historical accepted purchase cost.
- Migrations: `20260905194116_procurement_inventory_report_projections`, `20260905194501_purchase_cost_history_report_projection`.
- Verify #433 ✅.

### 8.4 Accounting Reports Integration ✅
- Trial Balance, General Ledger, Income Statement and Balance Sheet are integrated into the central workspace by reusing Batch 7 contracts.
- `accounting.statements.view` remains mandatory for financial statements.
- Verify #441 ✅.

### 8.5 Custom Columns + Excel Export ✅
- Operational and accounting reports support per-report selectable visible columns.
- Excel export uses the exact currently loaded filtered rows and the same selected columns; it does not refetch or widen scope.
- Exports include a separate totals worksheet and preserve numeric values using dependency-free SpreadsheetML `.xls` generation.
- Permission boundaries remain unchanged; accounting exports require the same statement permission as the displayed report.
- Verify #453 ✅ — Batch 5/6/7 regression, Typecheck, Build and Pages Deploy.

### 8.6 Central Printing 🚧 NEXT
- Centralized print workflows for Kitchen, receipts/reprints, shift close, day close and reports.
- Preserve immutable receipt snapshot and permission-aware reprint contracts.
- Reuse existing Kitchen/Receipt/Shift commands and projections; do not duplicate business logic.

### 8.7 Batch 8 Regression + Advisors + Verify ⏳

Immediate target: **8.6 Central Printing**.

## Batch 9 — Administration, Offline & Final UX ⏳ QUEUED
Branches/warehouses/users/effective permissions/settings/guided setup, offline critical close/printing, RTL/LTR/mobile/collapsible/touch/final glass UX.

## Batch 10 — Full Verification & Release Candidate ⏳ QUEUED
Typecheck, Build, Unit/contract tests, RLS/permission tests, Integration/E2E, cross-branch denial, offline retry, Advisors and release candidate.

## Current checkpoint
- Database: `scpovyrqmsbiduanykod` ✅
- Repository: `Premieros/pos.v2` ✅
- Branch: `development` ✅
- Batches 1–7: ✅ CLOSED.
- Batch 8.1–8.5: ✅ CLOSED.
- Immediate target: **8.6 Central Printing**.
- Verified implementation HEAD before this log update: `a1e37e7df8b54cd2f779c65a0b4235efa93939f0` — Verify #453 ✅.
- `main` untouched.

## Hardening backlog
- Enable Supabase Auth leaked-password protection before release: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Review unused-index INFO only after realistic workload.
- Keep credentials outside client/repository history.

## Final release gate
No `development` → `main` merge until Batches 8–10 are ✅, security hardening is ✅, no known P0/P1 regression remains, and explicit release approval is given.
