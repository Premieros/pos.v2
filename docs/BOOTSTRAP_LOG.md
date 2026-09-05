# POS.V2 — Bootstrap & Initial Admin Log

> This file records the one-time initial platform bootstrap. It must never contain passwords, service-role keys, database passwords, access tokens, or other secrets.

## Locked project identity

- Repository: `Premieros/pos.v2`
- Development branch: `development`
- Supabase project ref: `scpovyrqmsbiduanykod`
- Supabase project URL: `https://scpovyrqmsbiduanykod.supabase.co`
- Database identity rule: only this Supabase project may be used by POS.V2.

## Current bootstrap state — 2026-09-05

- ✅ Hidden immutable `super_admin` system role exists.
- ✅ `super_admin` automatically owns all defined permissions.
- ✅ Super Admin platform assignment is stored only in `app_private.platform_role_assignments`.
- ✅ One-time bootstrap RPC exists for first Super Admin + first branch.
- ✅ Bootstrap implementation is protected inside `app_private`; exposed wrapper is security-invoker.
- ✅ Public signup is not used for normal user administration.
- ✅ GitHub Pages development deployment is operational from `development` after successful Verify.
- ⏳ First Supabase Auth user has **not been created yet**.
- ⏳ Therefore the first Super Admin assignment and first branch bootstrap have **not executed yet**.

## Initial Auth user creation rule

The first Auth user must be created through a trusted Supabase Admin/Auth path. Do **not** manually insert into `auth.users`, `auth.identities`, or password hash columns.

Reason: direct SQL insertion bypasses the supported Supabase Auth lifecycle and can leave an invalid or partially-created identity.

The currently connected Supabase tooling exposes SQL/database administration but does not expose an Admin Auth `createUser` action. Therefore initial Auth user creation remains a one-time trusted dashboard/admin operation.

After that user exists, POS.V2 must immediately run the existing one-time bootstrap flow to:

1. create the first branch;
2. grant that user access to the branch;
3. assign the private hidden `super_admin` platform role;
4. permanently close the first-bootstrap path by its one-time conditions.

## Credential logging policy

- Email / user UUID may be logged after creation for auditability.
- Password must never be committed to GitHub or written into this file.
- Password is known only to the account owner and may be reset through Supabase Auth if lost.
- No service-role or database credentials may appear in repository history.

## Pending completion record

When the first user is created and bootstrap succeeds, replace this section with:

- Auth user email: `<email>`
- Auth user UUID: `<uuid>`
- Profile created: ✅
- First branch ID/code: `<branch>`
- Private Super Admin assignment: ✅
- Bootstrap re-run rejected: ✅
- Security Advisor after bootstrap: ✅ / findings
- Completed at: `<timestamp>`

Until that record is completed, the platform architecture is ready but there is no login account available for the published site.
