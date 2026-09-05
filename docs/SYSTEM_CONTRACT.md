# System Contract — POS.V2

## Source of truth
Supabase PostgreSQL is authoritative for persisted business state, authorization scope, inventory and financial transactions.

## Authorization invariant
`allowed(action, branch) = super_admin OR (branch_access AND effective_permission)`

Super Admin is stored in trusted database state, never user-editable metadata.

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
