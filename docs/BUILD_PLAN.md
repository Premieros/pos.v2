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
- Batches 1–9 ✅ CLOSED
- Batch 10 — Full Verification & Release Candidate 🚧 CURRENT

## Batch 8 ✅ CLOSED
Reports, accounting integration, custom columns/Excel, central printing and Batch 8 regression are closed. Final Verify #483 ✅.

## Batch 9 — Administration, Offline & Final UX ✅ CLOSED

### 9.1 Administration Workspace ✅
- Permission-first branch/warehouse/user/role/permission administration.
- Protected Super Admin remains private and un-targetable.
- Role templates cannot grant permissions the administrator does not hold.
- Migrations: `20260905201332_administration_workspace_contract`, `20260905201828_harden_administration_public_wrappers`.
- Public RPCs are SECURITY INVOKER; sensitive implementation is private.
- Verify #497 ✅.

### 9.2 Guided Setup / Prerequisite Routing ✅
- Fresh bootstrap is separated from “authenticated user has no accessible branch”.
- POS guides missing shift/warehouse/products to the exact allowed setup action instead of raw DB errors.
- Multi-branch users have explicit branch switching.
- Migration: `20260905202048_guided_initial_setup_state`.
- Verify #511 ✅.

### 9.3 Offline Critical Close + Print Resilience ✅
- Idempotent server-authoritative shift close with private command log and public SECURITY INVOKER wrapper.
- Migration: `20260905202507_idempotent_shift_close_for_offline_queue`.
- Offline queue is user+branch scoped and retries reuse one immutable idempotency key.
- Pending close printing is explicitly non-final until server confirmation.
- Cached day-summary printing is read-only and explicitly non-final.
- Verify #527 ✅.

### 9.4 RTL/LTR + Responsive App Shell ✅
- Arabic RTL / English LTR direction-aware shell.
- Sidebar right for Arabic and left for English.
- Collapsible desktop sidebar and real mobile drawer with overlay.
- Touch/scroll/overflow hardening.
- Verify #537 ✅.

### 9.5 Final Visual System ✅
- iOS-inspired glass surfaces applied after contracts stabilized.
- Shared `StatePanel` for loading/error/empty/unauthorized presentation.
- Reduced-motion and focus-visible support preserved.
- Verify #545 ✅.

### 9.6 Batch 9 Regression + Advisors + Verify ✅
- Added `scripts/verify-batch9.mjs` and CI gate.
- First guard run #551 correctly failed on a false shell marker only; no application regression was identified.
- Guard corrected to validate the real `data-mobile-nav="open"` responsive contract.
- Verify #553 ✅ — Batch 5/6/7/8/9 regression, Typecheck, Build and Pages Deploy all green.
- Security Advisor: only known leaked-password-protection Auth warning.
- Performance Advisor: unused-index INFO only.

## Batch 10 — Full Verification & Release Candidate 🚧 CURRENT

### 10.1 Repository / Build / Contract Verification 🚧 NEXT
- Run all regression guards together plus Typecheck and production Build.
- Validate database identity lock and migration parity.
- Add final repository release-candidate guard without weakening earlier guards.

### 10.2 Live Database Security & Permission Verification ⏳
- RLS presence and public grant audit for business tables.
- Public RPC wrapper / private implementation audit for sensitive operations.
- Protected Super Admin privacy and non-targetability checks.
- Cross-branch and missing-permission fail-closed verification where safely testable.

### 10.3 Operational Integration Verification ⏳
- Verify critical flow contracts across catalog, inventory, shift, POS, Kitchen, payment, return/refund, split, transfer/merge, receipt, procurement, waste/count/approval, accounting, reports and printing.
- Verify stock and accounting source lineage remains explicit and non-duplicating.
- Verify offline close retry contract is idempotent.

### 10.4 Release Candidate / Final Advisors / Deploy ⏳
- Final Security and Performance Advisors.
- Final Verify + Pages Deploy.
- Record release-candidate HEAD and known non-code platform hardening item.
- Do not merge to `main` without explicit user approval.

Immediate target: **10.1 Repository / Build / Contract Verification**.

## Current checkpoint
- Database: `scpovyrqmsbiduanykod` ✅
- Repository: `Premieros/pos.v2` ✅
- Branch: `development` ✅
- Batches 1–9: ✅ CLOSED.
- Batch 10: 🚧 CURRENT.
- Verified implementation HEAD before this log update: `28563c54ae8a6d161a0b5fc2b417d6c4203fe57b` — Verify #553 ✅.
- `main` untouched.

## Hardening backlog
- Enable Supabase Auth leaked-password protection before release: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Review unused-index INFO only after realistic workload.
- Keep credentials outside client/repository history.

## Final release gate
No `development` → `main` merge until Batch 10 is ✅, security hardening is ✅ or explicitly accepted as a platform setting dependency, no known P0/P1 regression remains, and explicit release approval is given.
