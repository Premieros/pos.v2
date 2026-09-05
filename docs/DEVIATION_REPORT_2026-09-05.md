# POS.V2 — Deviation & Release Gate Report

Date: 2026-09-05
Repository: `Premieros/pos.v2`
Development branch: `development`
Production branch: `main`
Locked Supabase project: `scpovyrqmsbiduanykod` (`pos.v2`)

## Executive status

**Release readiness: NOT 100% yet.**

The current development branch has a healthy clean-room foundation and is actively closing the Kitchen/KDS phase, but the canonical plan still lists multiple major phases after KDS. Therefore merging `development` into `main` as a final production release would be premature until the release gate below is fully green.

## Confirmed correct

- Repository is the new clean POS.V2 repository.
- Supabase identity is locked to `scpovyrqmsbiduanykod` only.
- Supabase project name is `pos.v2` and project status is healthy.
- Hidden immutable `super_admin` role exists by design.
- Authorization is permission-first; roles are labels/permission bundles rather than hard-coded UI authority.
- Authentication, branch context, scoped permissions, catalog, inventory, shifts and POS core foundations are present.
- Kitchen backend uses delta tickets and tracks `sent_quantity`.
- Kitchen stock movement is performed by the atomic `send_order_to_kitchen` command.
- The atomic kitchen command locks the order row before processing, checks an idempotency key, computes quantity deltas and rejects a no-change resend.
- KDS service and operational page are present.
- POS now exposes warehouse selection for kitchen deduction, KDS queue count, first send vs. send changes, and allows edit-after-send for the statuses supported by the backend delta contract.
- KDS is now wired into the application shell according to the latest active development changes.
- GitHub Verify runs typecheck and production build on development changes and deploys the development build to GitHub Pages only after the frontend job succeeds.

## Deviations / blockers

### D1 — Final product scope is incomplete — BLOCKER
Canonical next phases after Kitchen/KDS are still:

`Payments -> POS operational completion -> Procurement -> Waste/Counts/Approvals -> Accounting/Treasury -> Reports -> Printing -> Offline critical operations -> Settings/UI finalization -> Full E2E -> Release`

These are release scope, not optional polish. Until they are implemented and verified, the system cannot be truthfully declared 100% complete.

### D2 — Main and development histories are diverged — BLOCKER BEFORE MERGE
`development` is far ahead of `main` but `main` also contains commits not in the development history. A production merge must be performed through a reviewed PR/merge gate, not by assuming a fast-forward.

### D3 — CI gate is incomplete for a 100% release — BLOCKER
Current Verify checks TypeScript compilation and production build, but there is no full automated unit/integration/E2E suite in the current package scripts. A green build alone does not prove business correctness, branch isolation, exact-once stock movement, payments, offline close, reports or accounting flows.

### D4 — Kitchen/KDS verification gate is not fully evidenced — BLOCKER
The following still require explicit verification evidence before the KDS phase can be closed:
- exact-once stock movement for a positive delta;
- negative-delta inventory reversal;
- cross-branch KDS denial;
- complete permission matrix behavior for view/update/send actions.

### D5 — Auth hardening warning — PRE-RELEASE BLOCKER
Supabase Security Advisor currently reports `Leaked Password Protection Disabled`.
This is an Auth configuration warning and should be enabled before production release.

Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

### D6 — Performance advisor informational findings — REVIEW
Supabase Performance Advisor reports multiple currently-unused indexes. Because this database is newly created and has negligible production workload, unused-index findings alone are not evidence that the indexes are unnecessary. Do not remove them simply to make the advisor empty; validate query usage after realistic tests/load first.

## Merge gate

Do not merge `development` into `main` as a final release until ALL items below are green:

- [ ] Latest development Verify completed successfully.
- [ ] Kitchen/KDS exact-once + reversal tests passed.
- [ ] Cross-branch isolation tests passed.
- [ ] Payments complete and tested.
- [ ] POS operational completion complete and tested.
- [ ] Procurement complete and tested.
- [ ] Waste / counts / approvals complete and tested.
- [ ] Accounting / treasury complete and tested.
- [ ] Reports complete and reconciled against source transactions.
- [ ] Printing permissions / one-time print / controlled reprint complete.
- [ ] Offline critical operations complete and tested.
- [ ] Settings / permissions / user management final UI complete.
- [ ] Full E2E lifecycle passes from setup -> shift -> sale -> kitchen -> payment -> stock -> reports -> close.
- [ ] Security Advisor has no unresolved production warnings.
- [ ] Database identity assertion confirms `scpovyrqmsbiduanykod` and rejects any foreign project configuration.
- [ ] Release PR reviewed with no unresolved conflicts between `main` and `development`.

## Merge decision at time of this report

**HOLD FINAL MERGE.**

Reason: the user's quality requirement is to verify that everything works 100%. Current evidence proves a solid foundation and active KDS progress, but not completion of the remaining release scope. Merging now would contradict that quality gate.

This report should be updated as each blocker is closed. Final merge is permitted only when the checklist is fully green and the latest branch head is the verified head being merged.
