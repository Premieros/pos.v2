# Current Work Plan — POS.V2

## Current phase: POS Operational Completion

### Completed ✅
- Clean-room repository and architecture foundation.
- Database identity locked to Supabase project `scpovyrqmsbiduanykod` only.
- Authentication foundation and first supported Auth user.
- One-time first platform bootstrap completed.
- Initial branch `MAIN` created.
- Hidden immutable `super_admin` assignment completed and verified.
- Super Admin owns all current permissions automatically.
- Permission-first authorization and branch isolation.
- User/role/direct-permission administration contracts.
- Catalog foundation.
- Inventory foundation, warehouse isolation, stock ledger, BOM and direct product mapping.
- Atomic receipt / adjustment / waste / transfer commands.
- Shifts and cash drawer foundation.
- POS Core and all five order types.
- Dining-table occupancy contract.
- Kitchen / KDS backend + frontend.
- Initial kitchen send + later delta-only sends.
- Inventory deduction/reversal in the same kitchen transaction.
- KDS Start / Ready / Complete workflow.
- POS KDS counter and warehouse prerequisite guidance.
- Payments foundation + POS payment UI.
- Cash / Card.
- Partial and split payments.
- Server-authoritative remaining balance.
- Cash payments update drawer movement atomically; card does not affect physical cash.
- Fully-paid order close command.
- Payment idempotency.
- GitHub Verify pipeline and automatic GitHub Pages deployment from `development`.

### Latest verification
- Kitchen Verify #64: frontend + Typecheck + Build + Deploy ✅
- Payments Verify #79: Install + Typecheck + Build + GitHub Pages Deploy ✅
- Supabase Security Advisor: no database/RLS regression; one Auth hardening warning remains: **Leaked Password Protection Disabled**.
- Performance Advisor: no unresolved missing FK index after `payment_allocations_branch_index`; remaining notices are unused-index INFO on a new database.

### Current gate — POS Operational Completion 🚧
1. Discount command and permission/audit trail.
2. Void / cancellation after kitchen send with correct inventory/payment rules.
3. Return/refund contract.
4. Split bill without duplicate quantities/revenue.
5. Transfer dine-in order to another available table.
6. Merge table/order contract where safe.
7. Receipt print permission + reprint audit contract.
8. Customer display contract.
9. Verify all actions remain permission-first, not role-name based.
10. Security + performance advisors and GitHub Verify green.

### Next phases
Procurement -> Waste/Counts/Approvals -> Accounting/Treasury -> Reports -> Printing -> Offline critical operations -> Settings/UI finalization -> Full E2E -> Release.

## Source of Truth
- Canonical build ledger: `docs/BUILD_PLAN.md`
- Initial platform bootstrap audit: `docs/BOOTSTRAP_LOG.md`
- Database identity lock: `docs/DATABASE_IDENTITY_LOCK.md`

## Production rule
No merge from `development` to `main` until the final release gate passes and release is explicitly approved.
