# System Contract — POS.V2

## Source of truth
Supabase PostgreSQL is authoritative for persisted business state, authorization scope, inventory and financial transactions.

## Authorization invariant
For ordinary users:

`allowed(action, branch) = branch_access AND effective_permission`

Effective permission may come from a direct user grant or from a normal role template. An explicit direct user revoke wins over normal grants.

No application feature is authorized by checking a role name. Roles group permissions; feature code consumes permission keys only.

### Protected Super Admin
The platform has one special system role identified internally as `super_admin`.

- It is hidden from normal role/user management queries.
- It is immutable and cannot be edited or deleted through the application.
- It owns every permission in the permission registry.
- New permissions are automatically attached to it.
- Its user assignments live only in `app_private.platform_role_assignments` and are inaccessible to authenticated application users.
- It has platform-wide branch scope.
- Even for Super Admin, feature code checks the requested permission; no page or business action contains `role == super_admin` authorization logic.

Thus Super Admin is a protected full-permission platform identity while the application remains permission-first.

## Domain boundaries
- Identity & Access
- Branches
- Catalog
- Inventory
- POS Orders
- Kitchen
- Payments
- Shifts & Drawer
- Procurement
- Waste & Stock Operations
- Approvals
- Accounting
- Reports
- Printing
- Settings

Each module communicates through documented contracts. UI components never mutate another module's tables directly to simulate a business action.

## Order direction
Draft -> Created -> Kitchen -> Ready -> Payment -> Closed, with explicit Hold/Cancel/Void/Return transitions defined later in the order state-machine contract.

## Inventory rule
Inventory is ledger-driven. UI never directly increments/decrements authoritative stock quantities. Stock movement is created by a business command.

## Language/UI
Arabic RTL is primary. English LTR is secondary. Layout direction must not alter business logic.
