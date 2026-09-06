# Development Rules — POS.V2

These rules are mandatory for every change.

## 1. Clean-room rule
The legacy POS/ERP is a requirements reference only. Do not copy legacy implementation code by default.

## 2. Change Isolation Rule
Every fix or feature must change the smallest possible surface. Do not modify an unrelated module unless a direct dependency is proven and documented.

Before editing, state:
- intended behavior change;
- files/modules allowed to change;
- behavior explicitly required to remain unchanged;
- contracts affected;
- regression tests required.

## 3. No Hidden Coupling
A domain operation must never depend on component location, screen layout, role display name, or undocumented side effects.

## 4. Contract First
Define database/RPC/domain contracts before UI integration. Sensitive financial and inventory calculations are server authoritative.

## 5. Permission First — mandatory
Authorization requires an effective permission for every feature/action. No route, button, RPC, policy or business action may be authorized by a role-name check.

Roles are permission templates. A normal user may receive permissions directly without any role. Explicit per-user `revoke` overrides direct grants and normal role-template grants.

### Super Admin system role
`super_admin` is the one protected platform role. It is a hidden, immutable system role and is never exposed in normal role/user management surfaces.

- It owns every defined permission.
- Every newly created permission is automatically attached to it.
- Its row, permission membership and platform assignment cannot be edited or deleted by authenticated application users.
- Its platform assignment is stored only in the private `app_private` schema.
- A Super Admin has platform-wide branch access.
- Application authorization code still asks for the required permission (for example `pos.payment.take`), never `role == super_admin`.

This means Super Admin receives full authority through actual permissions while feature code remains permission-first and role-name agnostic.

## 6. RLS is mandatory
Every table exposed through the Data API must have RLS enabled and narrowly scoped policies. Never weaken RLS to make a test pass.

## 7. Transaction boundaries
A business action that must succeed or fail as one unit is implemented as one server-side transaction/command.

## 8. Regression before repair
For a bug: reproduce it, add a failing regression test when practical, fix root cause, run affected-module tests plus contract/security tests.

## 9. No unrelated refactors in fixes
Bug-fix PRs must not contain formatting sweeps, renames, dependency upgrades, or architecture rewrites unrelated to the defect.

## 10. Migration discipline
Migrations are forward-only after acceptance. Never edit an already-applied production migration. Schema changes require verification and security review.

## 11. Definition of Done
A feature is not done until backend contract, permissions, branch scope, UI states, error handling and automated verification are complete.
