# POS.V2 — Bootstrap & Initial Admin Log

> This file records the one-time initial platform bootstrap. It must never contain passwords, service-role keys, database passwords, access tokens, or other secrets.

## Locked project identity

- Repository: `Premieros/pos.v2`
- Development branch: `development`
- Supabase project ref: `scpovyrqmsbiduanykod`
- Supabase project URL: `https://scpovyrqmsbiduanykod.supabase.co`
- Database identity rule: only this Supabase project may be used by POS.V2.

## Bootstrap completion — 2026-09-05

- Auth user email: `sayed3la2@gmail.com`
- Auth user UUID: `71dcc9f6-03f3-4ab6-b50e-8684414b03f0`
- Profile created by supported Auth lifecycle: ✅
- Profile active: ✅
- Initial branch code: `MAIN`
- Initial branch Arabic name: `الفرع الرئيسي`
- Initial branch English name: `Main Branch`
- Initial branch UUID: `e214755b-bfe4-4bf5-b3a8-5bdf333a2ca1`
- User branch access granted: ✅
- Hidden immutable `super_admin` platform assignment stored in `app_private.platform_role_assignments`: ✅
- Super Admin permissions: `45 / 45` ✅
- Bootstrap one-time guard is now closed by state: `1 auth user / 1 branch / 1 platform assignment` ✅
- Verified at: `2026-09-05 14:40:45 UTC`

## Security verification after bootstrap

Supabase Security Advisor was run after the bootstrap.

- Database/RLS/security-definer findings related to the bootstrap: no new bootstrap-specific finding observed.
- Current Auth warning: **Leaked Password Protection Disabled**.
- Remediation reference: Supabase Auth password security / leaked password protection.

This Auth warning does not invalidate the bootstrap, but it remains a hardening task before production release.

## Credential logging policy

- Password is intentionally **not recorded** here or anywhere in GitHub.
- Password is known only to the account owner and should be reset through Supabase Auth if lost.
- No service-role key, database password, access token, or private credential may appear in repository history.

## Operational result

The published development application now has a valid first login identity and an initialized platform scope. The first user is the protected Super Admin and has access to the initial `MAIN` branch.

Future users must be created through the normal trusted user-administration path; the first-user bootstrap must not be used again.
