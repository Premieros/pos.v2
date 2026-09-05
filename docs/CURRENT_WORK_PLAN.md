# Current Work Plan — POS.V2

## Current phase: Kitchen / KDS

### Completed
- Clean-room repository and architecture foundation.
- Supabase project identity locked to `scpovyrqmsbiduanykod` only.
- Authentication foundation and profile trigger.
- Hidden immutable Super Admin role and permission-first authorization model.
- Initial Auth user created through supported Supabase Auth flow.
- First platform bootstrap completed.
- Initial branch `MAIN` created and assigned.
- First user linked to the hidden immutable `super_admin` platform role.
- Super Admin verified with `45 / 45` current permissions.
- Branch context and effective permission resolver.
- Scoped user/role/permission administration contracts.
- Catalog foundation.
- Inventory foundation, warehouse transfers, stock ledger and product/BOM mapping.
- Shifts and cash drawer foundation.
- POS Core.
- Kitchen backend contract: delta tickets, sent quantities, inventory deduction/reversal and KDS state commands.
- GitHub Verify pipeline.
- GitHub Pages deployment from `development` after successful Verify.

### Bootstrap status
- Initial platform bootstrap: ✅ complete.
- Auth users: `1`.
- Branches: `1`.
- Platform Super Admin assignments: `1`.
- Initial branch: `MAIN` / `الفرع الرئيسي` / `Main Branch`.
- Password is intentionally not stored in GitHub.
- One-time first-user bootstrap must not be used again.
- Full audit record: `docs/BOOTSTRAP_LOG.md`.

### Security note
- Supabase Security Advisor after bootstrap reported one Auth hardening warning: **Leaked Password Protection Disabled**.
- This remains a pre-release hardening item; no bootstrap-specific database security regression was observed.

### Current Kitchen / KDS gate
1. Finish POS `Send to Kitchen / Send Changes` UI.
2. Require/select warehouse and show guided prerequisite if missing.
3. Add KDS service and KDS page.
4. Add POS KDS counters and ticket actions: Start / Ready / Complete.
5. Verify exact-once stock movement per delta and negative-delta reversal.
6. Verify cross-branch KDS denial.
7. Security + performance advisors clean.
8. GitHub Verify green.

### Next phases
Payments -> POS operational completion -> Procurement -> Waste/Counts/Approvals -> Accounting/Treasury -> Reports -> Printing -> Offline critical operations -> Settings/UI finalization -> Full E2E -> Release.

## Source of Truth
- Canonical build ledger: `docs/BUILD_PLAN.md`
- Initial platform bootstrap audit: `docs/BOOTSTRAP_LOG.md`
- Database identity lock: `docs/DATABASE_IDENTITY_LOCK.md`

## Production rule
No merge from `development` to `main` until the final release gate passes and release is explicitly approved.
