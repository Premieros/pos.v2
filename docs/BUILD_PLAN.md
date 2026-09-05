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
- Batches 1–8 ✅ CLOSED
- Batch 9 — Administration, Offline & Final UX 🚧 CURRENT
- Batch 10 — Full Verification & Release Candidate ⏳ QUEUED

## Batch 8 ✅ CLOSED
Reports, accounting integration, custom columns/Excel, central printing and Batch 8 regression are closed. Final Verify #483 ✅.

## Batch 9 — Administration, Offline & Final UX 🚧 CURRENT

### 9.1 Administration Workspace ✅
- Permission-first branch/warehouse/user/role/permission administration.
- Protected Super Admin remains private and un-targetable.
- Role templates cannot grant permissions the administrator does not hold.
- Migrations: `20260905201332_administration_workspace_contract`, `20260905201828_harden_administration_public_wrappers`.
- Public RPCs are SECURITY INVOKER; sensitive implementation is private.
- Verify #497 ✅; Advisors: only known Auth leaked-password warning + unused-index INFO.

### 9.2 Guided Setup / Prerequisite Routing ✅
- Fresh bootstrap is separated from “authenticated user has no accessible branch”.
- POS guides missing shift/warehouse/products to the exact allowed setup action instead of raw DB errors.
- Multi-branch users have explicit branch switching.
- Migration: `20260905202048_guided_initial_setup_state`.
- Verify #511 ✅; Advisors unchanged.

### 9.3 Offline Critical Close + Print Resilience ✅
- Added idempotent server-authoritative shift close with private command log and public SECURITY INVOKER wrapper.
- Migration: `20260905202507_idempotent_shift_close_for_offline_queue`.
- Offline shift close stores a user+branch-scoped local pending intent with one immutable idempotency key; retries reuse the same key and cannot silently double-close.
- Pending close receipt is explicitly marked “awaiting server confirmation” and never presented as final close.
- Opening shifts and drawer financial movements remain online-only rather than inventing unsafe local postings.
- Day summary caches only an already-authorized report snapshot. Offline printing is clearly labeled cached Snapshot, not a final day-close/accounting posting because no day-close mutation contract exists.
- Receipt/reprint still requires server confirmation so print-event audit cannot be bypassed offline.
- Live audit: public `close_shift_idempotent` is SECURITY INVOKER; private implementation is definer; authenticated has no table privileges on private command log.
- Verify #527 ✅ — B5/B6/B7/B8 regressions, Typecheck, Build and Pages Deploy.
- Security Advisor: only known leaked-password-protection warning.
- Performance Advisor: unused-index INFO only.

### 9.4 RTL/LTR + Responsive App Shell 🚧 NEXT
- Arabic RTL primary and English LTR secondary.
- Sidebar right in Arabic / left in English, collapsible desktop and mobile drawer.
- Touch-friendly spacing and resilient overflow/scroll behavior.

### 9.5 Final Visual System ⏳
- Consistent iOS-inspired glass treatment after interaction/permission contracts are stable.
- Shared loading/error/empty/unauthorized states.

### 9.6 Batch 9 Regression + Advisors + Verify ⏳

Immediate target: **9.4 RTL/LTR + Responsive App Shell**.

## Batch 10 — Full Verification & Release Candidate ⏳ QUEUED
Typecheck, Build, Unit/contract tests, RLS/permission tests, Integration/E2E, cross-branch denial, offline retry, Advisors and release candidate.

## Current checkpoint
- Database: `scpovyrqmsbiduanykod` ✅
- Repository: `Premieros/pos.v2` ✅
- Branch: `development` ✅
- Batches 1–8: ✅ CLOSED.
- Batch 9.1–9.3: ✅ CLOSED.
- Immediate target: **9.4 RTL/LTR + Responsive App Shell**.
- Verified implementation HEAD before this log update: `6f1cb34fa50513cbc442226b6e7c4027296778fb` — Verify #527 ✅.
- `main` untouched.

## Hardening backlog
- Enable Supabase Auth leaked-password protection before release: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Review unused-index INFO only after realistic workload.
- Keep credentials outside client/repository history.

## Final release gate
No `development` → `main` merge until Batches 9–10 are ✅, security hardening is ✅, no known P0/P1 regression remains, and explicit release approval is given.
