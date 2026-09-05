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
- Accepted database changes are forward-only.
- Never weaken RLS/tests to make failures pass.
- Missing prerequisites use guided setup.
- No merge to `main` before explicit release approval.
- Persistent `DEMO` data must not be deleted without a new explicit user instruction.
- `Premieros/johna-s` is a **read-only feature/UX reference only**. Never write to it, run its workflows, touch its Supabase, copy its code, migrations, CSS, hooks or services.
- Feature parity means reproducing useful business capabilities cleanly inside POS.V2, not source parity.

## Current product status
- Batches 1–9 ✅ CLOSED historically.
- Batch 10 — Full Verification & Release Candidate ✅ CLOSED historically.
- Post-RC authenticated DEMO validation ✅ COMPLETE.
- **Feature-parity review proved the product UI/UX and operational capability set are not yet Final.**
- Release state is therefore reopened as: **PRODUCT COMPLETION IN PROGRESS**.
- Canonical completion plan: `docs/FEATURE_PARITY_PLAN.md`.
- Execution/audit log: `docs/FEATURE_PARITY_LOG.md`.
- Current execution target: **Batch 11 → Batch 12 POS Fullscreen Rebuild**.
- `main` remains untouched.

## Historical Batch 9 — Administration, Offline & Final UX ✅ CLOSED
- 9.1 Administration Workspace ✅ — Verify #497.
- 9.2 Guided Setup / Prerequisite Routing ✅ — Verify #511.
- 9.3 Offline Critical Close + Print Resilience ✅ — Verify #527.
- 9.4 RTL/LTR + Responsive App Shell ✅ — Verify #537.
- 9.5 Final Visual System ✅ — Verify #545.
- 9.6 Batch 9 Regression / Advisors / Verify ✅ — Verify #553.

## Historical Batch 10 — Full Verification & Release Candidate ✅ CLOSED

### 10.1 Repository / Build / Contract Verification ✅
- Added `scripts/verify-release-candidate.mjs` and independent `.github/workflows/release-guard.yml`.
- Release guard verifies the locked Supabase identity, required regression guards/migrations, public frontend environment contract, key module integration, and scans TS/TSX source against broad `pos.sell`, role-label authorization and service-role leakage.
- Three legacy migration filenames were aligned to the production migration versions without changing SQL or executing DDL:
  - `20260905132049_bootstrap_first_super_admin_and_branch.sql`
  - `20260905132455_scoped_user_permission_management.sql`
  - `20260905132922_harden_bootstrap_security_definer_scope.sql`
- Migration alignment HEAD: `07cd298cc8da43aedd8d8029a915f26eea12e4b6`.
- Release Guard #13 ✅.
- Verify #573 ✅ — Batch 5/6/7/8/9 regression, Typecheck, Build and Pages Deploy all green.

### 10.2 Live Database Security & Permission Verification ✅
Read-only audit against the locked production project confirmed:
- every `public` base table has RLS enabled;
- no live `public` function is `SECURITY DEFINER`;
- reviewed sensitive operational tables are authenticated `SELECT`-only;
- `app_private.platform_role_assignments` has no authenticated table privileges;
- protected `super_admin` is `is_system=true`, `is_hidden=true`, `is_immutable=true`.

### 10.3 Operational Integration Verification ✅
- Structural lineage verified across Kitchen/order items, stock movements, purchase receipts, waste, stock count, split payments, table merge, expenses and accounting source postings.
- Kitchen lineage uses `kitchen_ticket_items.order_item_id` with composite branch FK to `order_items`.
- Live RPC audit verified critical public operational RPCs use the public invoker contract.
- Offline shift close retains the idempotent server-authoritative retry contract.

### 10.4 Release Candidate / Final Advisors / Deploy ✅
- Security Advisor: no schema/code security finding; only Supabase Auth platform warning **Leaked Password Protection Disabled** remains.
- Performance Advisor: `unused_index` INFO only on current workload; no material finding.
- Release Guard #15 ✅.
- Verify #575 + Pages Deploy ✅.

## Post-RC design and demo work — historical checkpoint
- Persistent dedicated `DEMO` branch remains seeded and retained.
- Authenticated application-path smoke exposed and fixed the invoker/private execute contract gap through forward-only migration `20260905212439_fix_invoker_wrapper_private_execute_contract.sql`.
- Post-fix implementation commit `14269e5ed2ad110850069761d51e729cd3686bc4` passed CI #263, Release Guard #24 and Verify #584.
- Subsequent shell work changed module navigation from stacked anchors to one active workspace at a time.
- Subsequent POS/header visual work improved density but **does not constitute feature parity or final POS productization**.

## Product Completion Program — ACTIVE

### Batch 11 — Application Shell, Navigation & Workspace Architecture — CURRENT
- real module/deep-link navigation;
- compact global header;
- grouped sidebar;
- command/quick navigation;
- online/offline + pending action indicators;
- approvals/orders/KDS/low-stock indicators when authorized;
- responsive + RTL/LTR verification.

### Batch 12 — POS Fullscreen Rebuild — NEXT / HIGHEST PRIORITY
- dedicated fullscreen POS shell;
- compact POS top bar;
- fast order-type/start workflow;
- product catalog with categories, search, SKU/barcode, images and stock/availability;
- cart/current-order UX;
- item +/-/remove/void/sent states;
- modifiers and notes;
- kitchen first-send/delta-send UX;
- active orders and queue panels;
- floor/tables occupancy, transfer and merge;
- discounts/split bill;
- dedicated checkout/payment workspace;
- Cash/Card/Split Tender and change calculation;
- customer/delivery context;
- receipt/customer display;
- keyboard shortcuts and explicit offline boundaries.

### Batch 13 — Catalog, Customers & Commercial Setup
Products, categories, images, barcode, product wizard, modifiers, kitchen station/routing adaptation, customers/addresses and validated pricing/tax settings where required.

### Batch 14 — Operations Center
Operational dashboard, productized KDS, takeaway/drive-thru/delivery queues, shift workspace and close summary/print.

### Batch 15 — Inventory, Costing & Procurement Completion
Inventory center, ledger/transfers/low stock, valuation, costing/BOM/margin, waste, stock count/approval, procurement center, controlled import/export.

### Batch 16 — Accounting, Treasury & Reconciliation Productization
Account tree, journal editor/history, expenses, treasury/banks, reconciliation and source-posting diagnostics.

### Batch 17 — Reports & Management Information
Unified sales/operations, inventory/procurement/cost, accounting, audit, export/print and compact filter/table UX.

### Batch 18 — Administration & System Control Center
Branches, warehouses, users, branch access, role templates, direct permissions, protected Super Admin, settings, printing/POS/KDS preferences, diagnostics and controlled data management.

### Batch 19 — Cross-Cutting Product Quality
Keyboard/touch/accessibility, responsive/RTL QA, shared feedback states, confirmations, money/date formatting, safe optimistic UI, offline boundaries, print layouts and auditability.

### Batch 20 — Full Feature-Parity Verification & Production Gate
End-to-end operational/security/visual verification using retained DEMO data plus controlled rollback fixtures where needed.

## Reference capability exclusions / translations
- Do not restore legacy subscriptions unless explicitly reintroduced as a new product requirement.
- Do not restore the old raw-material/manufacturing subsystem merely for parity.
- Useful outcomes such as recipe/BOM cost, component consumption and waste are implemented through POS.V2's accepted product + inventory-item + `product_components` model.
- No insecure role-label authorization, client-authoritative critical mutation, duplicated state model or unverified workaround may cross from the reference.

## Current checkpoint
- Database: `scpovyrqmsbiduanykod` ✅
- Repository: `Premieros/pos.v2` ✅
- Branch: `development` ✅
- Historical contracts/Batches 1–10: ✅ CLOSED.
- Persistent full DEMO dataset: ✅ SEEDED AND RETAINED.
- Feature parity program: 🔄 ACTIVE.
- Current batch: **11**.
- Immediate product focus: **12 — POS Fullscreen Rebuild**.
- Release Candidate label: **withdrawn until Batches 11–20 pass**.
- `main`: untouched.

## Known external hardening item
Enable Supabase Auth leaked-password protection before production release, or explicitly accept it as an external platform-setting dependency:
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

Unused-index INFO should be reviewed after realistic production workload, not silenced by deleting useful indexes during product completion.

## Final release gate
**Do not merge `development` → `main` without explicit user approval.** The persistent DEMO dataset is not cleanup-authorized. POS.V2 is not Final until Batches 11–20 and the full feature-parity/security/visual gate are green.