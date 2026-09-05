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
Authorization requires both branch access and an effective permission. No feature, route, button, RPC, policy or business action may be authorized by a role name.

Roles are optional permission templates only. A user may receive permissions directly without any role. Explicit per-user `revoke` overrides direct grants and role-template grants.

There is no role-based implicit bypass. Elevated users receive their authority through actual permission records and pass the same authorization resolver as every other user.

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
