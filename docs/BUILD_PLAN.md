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

## Batch status
- Batches 1–9 ✅ CLOSED
- Batch 10 — Full Verification & Release Candidate ✅ CLOSED
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
No production test identities/data were created merely to simulate cross-branch denial; fail-closed behavior remains covered by the established RLS/permission contracts and regression guards.

### 10.3 Operational Integration Verification ✅
- Structural lineage verified across Kitchen/order items, stock movements, purchase receipts, waste, stock count, split payments, table merge, expenses and accounting source postings.
- Kitchen lineage uses `kitchen_ticket_items.order_item_id` with composite branch FK to `order_items`, not a separate `source_order_item_id` column.
- Corrected live RPC audit verified **21/21 critical public operational RPCs exist and are SECURITY INVOKER**, covering Kitchen, payments, close, discounts, voids, return/refund flow, split bill/payment, transfer/merge, receipts, procurement, waste, count/approval, accounting and reports.
- Offline shift close retains the idempotent server-authoritative retry contract.

### 10.4 Release Candidate / Final Advisors / Deploy ✅
- Final Security Advisor: no schema/code security finding; only Supabase Auth platform warning **Leaked Password Protection Disabled** remains.
- Final Performance Advisor: `unused_index` INFO only on the current low/fresh workload; no material performance finding.
- Final RC documentation HEAD before this update: `df11f9ce22e18ef36ce56a11262c77cd8ccbd092`.
- Release Guard #15 ✅ on the final RC documentation state.
- Verify #575 ✅ — Batch 5/6/7/8/9 regression, Typecheck, Build and Pages Deploy all green.
- Pages Deploy ✅.

## Current checkpoint
- Database: `scpovyrqmsbiduanykod` ✅
- Repository: `Premieros/pos.v2` ✅
- Branch: `development` ✅
- Batches 1–10: ✅ CLOSED.
- Release Candidate: ✅ READY.
- Final verified RC documentation state: `df11f9ce22e18ef36ce56a11262c77cd8ccbd092` — Release Guard #15 ✅ / Verify #575 ✅ / Deploy ✅.
- `main`: untouched.

## Known external hardening item
Enable Supabase Auth leaked-password protection before production release, or explicitly accept it as an external platform-setting dependency:
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

Unused-index INFO should be reviewed after realistic production workload, not silenced by deleting useful indexes during RC.

## Final release gate
**Do not merge `development` → `main` without explicit user approval.** Release requires the leaked-password-protection platform setting to be enabled or explicitly accepted as an external dependency.