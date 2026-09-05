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
- 8.1 Unified Reports ✅ — Verify #411.
- 8.2 Sales & Operations Reports ✅ — Verify #421.
- 8.3 Procurement, Inventory & Cost Reports ✅ — Verify #433.
- 8.4 Accounting Reports Integration ✅ — Verify #441.
- 8.5 Custom Columns + Excel Export ✅ — Verify #453.
- 8.6 Central Printing ✅.
- 8.7 Batch 8 Regression / Advisors / Verify ✅ — Verify #483, HEAD `276dffb71c9ed7030c942f8a414dc76600373976`.

## Batch 9 — Administration, Offline & Final UX 🚧 CURRENT

### 9.1 Administration Workspace ✅
- Added permission-first administration workspace for branch, warehouses, ordinary users, branch access, ordinary role templates and direct permission overrides.
- Protected platform Super Admin membership remains private, is excluded from administrative snapshots and cannot be targeted by branch/user mutations.
- Role-template create/update blocks privilege escalation: administrators cannot place a permission they do not effectively hold into a role.
- New migrations:
  - `20260905201332_administration_workspace_contract`
  - `20260905201828_harden_administration_public_wrappers`
- Public administration RPCs are `SECURITY INVOKER`; sensitive implementation lives under `app_private` with explicit guards.
- Live audit confirmed public wrappers are invoker and protected helpers are not directly executable.
- Verify #497 ✅ — Batch 5/6/7/8 regressions, Typecheck, Build and Pages Deploy.
- Security Advisor after hardening: only known leaked-password-protection Auth warning.
- Performance Advisor: unused-index INFO only.

### 9.2 Guided Setup / Prerequisite Routing ✅
- Fresh-system bootstrap is now distinguished from an already initialized system where the signed-in user simply lacks branch access; bootstrap is never offered again in that case.
- Migration `20260905202048_guided_initial_setup_state` provides the safe initialization-state contract through an invoker public wrapper and private implementation.
- POS prerequisites now surface a guided workspace before the sale flow for missing own shift, active warehouse or sale product.
- Where the user has the necessary setup permission, the warning contains a direct route to the exact setup section; otherwise it explains that authorized administration is required instead of exposing a raw database error.
- Multi-branch authorized users now get an explicit current-branch selector in the app header.
- Verify #511 ✅ — Batch 5/6/7/8 regressions, Typecheck, Build and Pages Deploy.
- Security Advisor: only known leaked-password-protection Auth warning.
- Performance Advisor: unused-index INFO only.

### 9.3 Offline Critical Close + Print Resilience 🚧 NEXT
- Offline-capable shift/day close capture and printing where contractually safe.
- Explicit queued/retry state for operations requiring server confirmation; no silent double-posting.
- Server remains authoritative for final close posting and idempotency.

### 9.4 RTL/LTR + Responsive App Shell ⏳
- Arabic RTL primary and English LTR secondary.
- Sidebar right in Arabic / left in English, collapsible desktop and mobile drawer.
- Touch-friendly spacing and resilient overflow/scroll behavior.

### 9.5 Final Visual System ⏳
- Consistent iOS-inspired glass treatment after interaction/permission contracts are stable.
- Shared loading/error/empty/unauthorized states.

### 9.6 Batch 9 Regression + Advisors + Verify ⏳

Immediate target: **9.3 Offline Critical Close + Print Resilience**.

## Batch 10 — Full Verification & Release Candidate ⏳ QUEUED
Typecheck, Build, Unit/contract tests, RLS/permission tests, Integration/E2E, cross-branch denial, offline retry, Advisors and release candidate.

## Current checkpoint
- Database: `scpovyrqmsbiduanykod` ✅
- Repository: `Premieros/pos.v2` ✅
- Branch: `development` ✅
- Batches 1–8: ✅ CLOSED.
- Batch 9.1–9.2: ✅ CLOSED.
- Immediate target: **9.3 Offline Critical Close + Print Resilience**.
- Verified implementation HEAD before this log update: `85560f7cafb44c4dd20763d454dd0963a6f48c18` — Verify #511 ✅.
- `main` untouched.

## Hardening backlog
- Enable Supabase Auth leaked-password protection before release: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Review unused-index INFO only after realistic workload.
- Keep credentials outside client/repository history.

## Final release gate
No `development` → `main` merge until Batches 9–10 are ✅, security hardening is ✅, no known P0/P1 regression remains, and explicit release approval is given.
