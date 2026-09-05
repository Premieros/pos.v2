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

## Batch status
- Batches 1–9 ✅ CLOSED
- Batch 10 — Full Verification & Release Candidate ✅ CLOSED
- Post-RC design polish + persistent full demo validation ✅ COMPLETE
- Release state: **RC READY — awaiting explicit approval; `main` untouched**

## Batch 9 — Administration, Offline & Final UX ✅ CLOSED
- 9.1 Administration Workspace ✅ — Verify #497.
- 9.2 Guided Setup / Prerequisite Routing ✅ — Verify #511.
- 9.3 Offline Critical Close + Print Resilience ✅ — Verify #527.
- 9.4 RTL/LTR + Responsive App Shell ✅ — Verify #537.
- 9.5 Final Visual System ✅ — Verify #545.
- 9.6 Batch 9 Regression / Advisors / Verify ✅ — Verify #553.

## Batch 10 — Full Verification & Release Candidate ✅ CLOSED

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

## Post-RC final design polish ✅
- Final production visual polish applied in `src/styles/final-ui.css`.
- Stronger glass hierarchy, clearer card/table/totals contrast, sticky desktop workspace header, improved product/POS selected states, consistent focus/touch states, scrollbar polish and responsive preservation.
- Authorization and business logic remain outside the layout/CSS layer.
- Implementation commit: `71cd6d08f3c27f445482decfd42c30e72e187545`.

## Persistent full demo dataset ✅
- Dedicated branch code `DEMO`: `فرع تجريبي كامل / Full Demo Branch`.
- Existing `MAIN` branch was not used as the demo container.
- Dataset is intentionally persistent and documented in `docs/DEMO_DATA_LOG.md`.
- Coverage includes warehouses, categories, inventory/BOM, products, suppliers, dining tables, open/closed shifts, multiple POS lifecycle states, KDS, Cash/Card payments, return/refund, purchases/receipts/cost history, waste, stock count/approval, chart of accounts, balanced journals, expense and treasury.
- Verified snapshot includes 7 products, 8 inventory items, 6 orders / 14 lines, 4 Kitchen tickets, 3 payments, 2 purchase orders, 1 receipt, 1 waste, 1 stock count + approval, 7 accounts, 3 balanced journals, 1 expense and 2 treasury accounts.
- Demo data must remain until a future explicit cleanup request.

## Full authenticated application-path validation ✅
The dedicated DEMO dataset was tested from the real application authorization context using PostgreSQL role `authenticated` and the real application user JWT subject, not only through maintenance access.

Read smoke passed for:
- branch visibility and effective permissions;
- unified report filter options;
- sales/operations reports;
- procurement/inventory and purchase-cost-history reports;
- trial balance and balance sheet;
- statement accounts;
- administration snapshot;
- customer display projection;
- guided setup state.

Mutation smoke passed inside an explicit transaction that was rolled back after verification:
- supplier create;
- POS order create + line + hold/resume;
- purchase order + line;
- waste document + line;
- stock count + counted line;
- journal + balanced journal lines.

## Regression discovered by demo testing and fixed ✅
The authenticated smoke test found a real RPC contract gap: some public `SECURITY INVOKER` wrappers referenced `app_private` functions whose `EXECUTE` privilege had been revoked from `authenticated`, causing authorized frontend calls to fail at the internal function boundary.

Forward-only fix:
- `20260905212439_fix_invoker_wrapper_private_execute_contract.sql`

The fix grants authenticated execution only to private function signatures that are actually referenced by public invoker wrappers. Internal functions retain their permission/branch assertions and `app_private` remains implementation-only rather than the frontend API contract.

Post-fix authenticated read and mutation smoke tests passed.
Post-fix implementation commit `14269e5ed2ad110850069761d51e729cd3686bc4`:
- CI #263 ✅
- Release Guard #24 ✅
- Verify #584 ✅
- Typecheck ✅
- Build ✅

Post-DDL Advisors:
- Security: only known leaked-password-protection platform warning.
- Performance: unused-index INFO only.

## Current checkpoint
- Database: `scpovyrqmsbiduanykod` ✅
- Repository: `Premieros/pos.v2` ✅
- Branch: `development` ✅
- Batches 1–10: ✅ CLOSED.
- Final design polish: ✅ COMPLETE.
- Persistent full DEMO dataset: ✅ SEEDED AND RETAINED.
- Authenticated application smoke: ✅ PASSED after RPC contract fix.
- Release Candidate: ✅ READY pending only CI confirmation for the final documentation commits.
- `main`: untouched.

## Known external hardening item
Enable Supabase Auth leaked-password protection before production release, or explicitly accept it as an external platform-setting dependency:
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

Unused-index INFO should be reviewed after realistic production workload, not silenced by deleting useful indexes during RC.

## Final release gate
**Do not merge `development` → `main` without explicit user approval.** The persistent DEMO dataset is not cleanup-authorized. Release requires final documentation-only CI to remain green and the leaked-password-protection platform setting to be enabled or explicitly accepted as an external dependency.
