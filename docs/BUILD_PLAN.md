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
- Uses the unified branch/date/payment/employee/product/order-type filter contract.
- Migration: `20260905193209_sales_operations_report_projections`.
- Verify #421 ✅.

### 8.3 Procurement, Inventory & Cost Reports ✅
- Purchases/suppliers with ordered/received quantities and accepted receipt value.
- Ledger-derived inventory balances plus period inbound/outbound and low-stock indicators.
- Formal waste report by warehouse/item/date.
- Historical accepted purchase-cost report from `inventory_item_purchase_cost_history`, including quantity, unit cost, total cost and weighted average cost without rewriting historical costs.
- Migrations: `20260905194116_procurement_inventory_report_projections`, `20260905194501_purchase_cost_history_report_projection`.
- Private report functions are non-executable by authenticated; public wrappers remain permission/branch guarded.
- Security Advisor: only known leaked-password-protection Auth warning.
- Performance Advisor: unused-index INFO only; no material report-specific finding.
- Verify #433 ✅ — regressions / Typecheck / Build / Pages Deploy.

### 8.4 Accounting Reports Integration 🚧 NEXT
- Integrate Trial Balance, General Ledger, Income Statement and Balance Sheet into the central reports experience.
- Reuse the existing Batch 7 read-only statement RPCs and `accounting.statements.view`; do not duplicate accounting calculations or weaken permissions.

### 8.5 Custom Columns + Excel Export ⏳
- User-selectable report columns.
- Excel export based on the same filtered result and totals.

### 8.6 Central Printing ⏳
- Centralized print workflows for Kitchen, receipts/reprints, shift close, day close and reports.
- Permission-aware reprint behavior; receipt immutable snapshot contract remains authoritative.

### 8.7 Batch 8 Regression + Advisors + Verify ⏳

Immediate target: **8.4 Accounting Reports Integration**.

## Batch 9 — Administration, Offline & Final UX ⏳ QUEUED
Branches/warehouses/users/effective permissions/settings/guided setup, offline critical close/printing, RTL/LTR/mobile/collapsible/touch/final glass UX.

## Batch 10 — Full Verification & Release Candidate ⏳ QUEUED
Typecheck, Build, Unit/contract tests, RLS/permission tests, Integration/E2E, cross-branch denial, offline retry, Advisors and release candidate.

## Current checkpoint
- Database: `scpovyrqmsbiduanykod` ✅
- Repository: `Premieros/pos.v2` ✅
- Branch: `development` ✅
- Batches 1–7: ✅ CLOSED.
- Batch 8.1–8.3: ✅ CLOSED.
- Immediate target: **8.4 Accounting Reports Integration**.
- Verified implementation HEAD before this log update: `a1313bec2a020173fa082fd51f4c4adb6224bc09` — Verify #433 ✅.
- `main` untouched.

## Hardening backlog
- Enable Supabase Auth leaked-password protection before release: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Review unused-index INFO only after realistic workload.
- Keep credentials outside client/repository history.

## Final release gate
No `development` → `main` merge until Batches 8–10 are ✅, security hardening is ✅, no known P0/P1 regression remains, and explicit release approval is given.
