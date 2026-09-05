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
- Batch 8 — Reports & Central Printing ✅ CLOSED
- Batch 9 — Administration, Offline & Final UX 🚧 CURRENT
- Batch 10 — Full Verification & Release Candidate ⏳ QUEUED

## Batch 8 — Reports & Central Printing ✅ CLOSED

### 8.1 Unified Reports Contract ✅
- One table-first Reports workspace, `reports.view`, branch-scoped server access and shared date/payment/employee/product/order-type filters.
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
- Trial Balance, General Ledger, Income Statement and Balance Sheet reuse Batch 7 contracts.
- `accounting.statements.view` remains mandatory for financial statements.
- Verify #441 ✅.

### 8.5 Custom Columns + Excel Export ✅
- Selectable report columns for operational and accounting reports.
- Export uses only the currently loaded filtered rows and selected columns.
- SpreadsheetML `.xls` export includes totals and preserves numeric values.
- Verify #453 ✅.

### 8.6 Central Printing ✅
- Central printing workspace for receipt first/reprint, Kitchen ticket, shift summary and day summary.
- Receipt printing checks existing print state first; reprint requires `pos.receipt.reprint`, reason and immutable receipt snapshot reuse.
- Kitchen/Shift/Day printing remains read-only and reuses existing authorized data contracts.
- Reports can print the exact currently visible result/columns without refetching broader data.

### 8.7 Batch 8 Regression + Advisors + Verify ✅
- Added `scripts/verify-batch8.mjs` and workflow gate.
- Corrected the Excel guard to validate the actual SpreadsheetML contract instead of a false marker.
- Batch 5/6/7/8 regression ✅, Typecheck ✅, Build ✅, Pages Deploy ✅.
- Verify #483 ✅ — HEAD `276dffb71c9ed7030c942f8a414dc76600373976`.
- Security Advisor: only known leaked-password-protection Auth warning.
- Performance Advisor: unused-index INFO only; no material Batch 8 finding.

## Batch 9 — Administration, Offline & Final UX 🚧 CURRENT

### 9.1 Administration Workspace 🚧 NEXT
- Branches and warehouses administration using existing branch/warehouse contracts.
- Users, branch access, effective permissions, role templates and direct grant/revoke controls without exposing protected Super Admin membership.
- System settings workspace with permission-first visibility.
- No role-label authorization in feature code.

### 9.2 Guided Setup / Prerequisite Routing ⏳
- Missing branch, warehouse, shift, catalog/inventory prerequisites route to the required setup action instead of raw database errors.
- Keep business contracts independent from layout/navigation.

### 9.3 Offline Critical Close + Print Resilience ⏳
- Offline-capable shift/day close capture and printing where contractually safe.
- Explicit queued/retry state for operations requiring server confirmation; no silent double-posting.

### 9.4 RTL/LTR + Responsive App Shell ⏳
- Arabic RTL primary and English LTR secondary.
- Sidebar right in Arabic / left in English, collapsible desktop and mobile drawer.
- Touch-friendly spacing and resilient overflow/scroll behavior.

### 9.5 Final Visual System ⏳
- Consistent iOS-inspired glass treatment after interaction/permission contracts are stable.
- Shared loading/error/empty/unauthorized states.

### 9.6 Batch 9 Regression + Advisors + Verify ⏳

Immediate target: **9.1 Administration Workspace**.

## Batch 10 — Full Verification & Release Candidate ⏳ QUEUED
Typecheck, Build, Unit/contract tests, RLS/permission tests, Integration/E2E, cross-branch denial, offline retry, Advisors and release candidate.

## Current checkpoint
- Database: `scpovyrqmsbiduanykod` ✅
- Repository: `Premieros/pos.v2` ✅
- Branch: `development` ✅
- Batches 1–8: ✅ CLOSED.
- Batch 9: 🚧 CURRENT.
- Immediate target: **9.1 Administration Workspace**.
- Verified implementation HEAD before this log update: `276dffb71c9ed7030c942f8a414dc76600373976` — Verify #483 ✅.
- `main` untouched.

## Hardening backlog
- Enable Supabase Auth leaked-password protection before release: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Review unused-index INFO only after realistic workload.
- Keep credentials outside client/repository history.

## Final release gate
No `development` → `main` merge until Batches 9–10 are ✅, security hardening is ✅, no known P0/P1 regression remains, and explicit release approval is given.
