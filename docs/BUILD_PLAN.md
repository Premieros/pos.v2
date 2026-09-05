# POS.V2 — Canonical Build Plan

> **Source of Truth for build progress.**
> This file records what is completed, what is in progress, what remains, and the verification gate required to close each phase.
>
> **Repository:** `Premieros/pos.v2`
> **Development branch:** `development`
> **Supabase project:** `scpovyrqmsbiduanykod`
> **Rule:** do not merge `development` into `main` until the final verification gate is green and the release is explicitly approved.

---

## 1. Mandatory engineering rules

- Clean-room rebuild: the previous system is requirements reference only; do not copy legacy implementation code by default.
- Permission-first authorization. Roles are labels/templates, not authority by themselves.
- Super Admin is the only implicit platform-wide bypass.
- Every branch-scoped action requires branch access + effective permission unless Super Admin.
- Every exposed `public` table must have RLS.
- Never weaken RLS or tests to make a failure disappear.
- Critical financial, inventory, shift, kitchen and payment mutations are server-authoritative atomic commands.
- No direct client multi-table transaction logic.
- Every stateful domain must use explicit state transitions.
- Every critical command should be idempotent where duplication would be harmful.
- A UI layout change must never change domain behavior or permissions.
- Bug fixes must touch the smallest possible surface and include a regression check.
- Missing prerequisites should produce guided setup/navigation, not raw database errors.
- One concern per change group; no unrelated refactors during a bug fix.
- Applied migrations are forward-only; never rewrite accepted production history.

---

## 2. Current global status

### Completed core phases

- ✅ Repository foundation and clean architecture rules
- ✅ Supabase connection and clean schema initialization
- ✅ Authentication foundation
- ✅ First Super Admin bootstrap
- ✅ Branch context
- ✅ Permission resolver and effective permissions
- ✅ User/role/branch permission foundations
- ✅ Catalog foundation
- ✅ Inventory foundation
- ✅ Atomic stock movements and warehouse transfers
- ✅ Shifts and cash drawer foundation
- ✅ POS Core
- ✅ Product-to-inventory mapping contract
- 🚧 Kitchen / KDS integration

### Not started / not closed yet

- ⏳ Payments
- ⏳ Discounts / void / returns / refunds
- ⏳ Split bill and payment allocations
- ⏳ Table merge / transfer operational commands
- ⏳ Procurement and purchasing
- ⏳ Waste / counts / approvals completion
- ⏳ Accounting / treasury
- ⏳ Reports
- ⏳ Printing
- ⏳ Offline critical commands
- ⏳ Settings administration UI
- ⏳ Full E2E regression cycle
- ⏳ Production release / main merge

---

## 3. Phase history — completed

### Phase A — Repository & architecture foundation ✅

Completed:
- New repository initialized as a clean rebuild.
- `development` branch established as the active development branch.
- React + TypeScript + Vite foundation created.
- Supabase browser client created with environment placeholders only.
- Architecture and development rules documented.
- No legacy implementation copied.

Definition of Done:
- ✅ Project builds through GitHub Verify after subsequent foundations were added.
- ✅ Secrets are not committed.

---

### Phase B — Identity, Auth, Branches & Permissions ✅

Completed:
- `profiles`
- `branches`
- `permissions`
- `roles`
- `role_permissions`
- `user_branch_access`
- `user_role_assignments`
- Effective permission API
- Permission-first branch authorization
- Immutable/trusted Super Admin model
- First Super Admin + initial branch bootstrap
- Scoped user permission management
- Cross-branch role assignment protection
- Current-user wrappers binding authorization to `auth.uid()`

Key invariant:

```text
allowed(action, branch) = super_admin OR (branch_access AND effective_permission)
```

Completed hardening:
- ✅ RLS enabled on exposed business tables
- ✅ No arbitrary caller-supplied user ID for authenticated authorization paths
- ✅ Super Admin authority not derived from editable user metadata
- ✅ Security Advisor clean after foundation changes

---

### Phase C — Catalog ✅

Completed:
- Categories
- Products
- Branch-scoped catalog
- Product pricing
- Product activation
- Catalog RLS and permission policies

Current product inventory contract:
- Product can use **one** of:
  1. Direct inventory item mapping for a ready product
  2. BOM through `product_components`
- System prevents using both mapping strategies at the same time.

Remaining catalog enhancements are deferred until operational demand requires them:
- ⏳ Modifier groups/options
- ⏳ Modifier min/max rules
- ⏳ Product images
- ⏳ Advanced pricing/tax configuration

---

### Phase D — Inventory ✅

Completed:
- Warehouses
- Inventory items
- Stock movement ledger
- Inventory balances derived from movements
- Product components / BOM
- Warehouse transfers
- Stock receipt
- Adjustment
- Waste movement type
- Count adjustment movement type
- Return-in / return-out movement types
- Atomic stock movement command
- Atomic transfer command
- Idempotency for critical stock commands
- Cross-branch inventory constraints
- Product direct inventory mapping command
- UI for warehouse setup, inventory item setup and stock operations
- UI for direct ready-product mapping and BOM component setup

Important rule:
- Authoritative stock is ledger-based; UI never directly writes a balance.

Verify:
- ✅ Verify #46 passed Install + Typecheck + Build after inventory/product mapping workspace.

Remaining inventory-related work:
- ⏳ Formal stock-count document workflow
- ⏳ Approval flow for sensitive adjustments
- ⏳ Purchase receipt linkage
- ⏳ Low-stock alerts UI

---

### Phase E — Shifts & Cash Drawer ✅

Completed:
- Shift table and state
- Open shift command
- Close shift command
- Cash drawer movements
- Expected cash / actual cash / difference
- Shift permissions
- Own-shift visibility
- Manager visibility
- RLS policy optimization
- Fixed drawer movement branch predicate bug
- FK covering indexes
- UI integrated into application shell

Verify:
- ✅ Verify #32 passed and Shifts were declared Done.

Remaining shift extensions:
- ⏳ Link cash payment movements automatically from Payments
- ⏳ End-of-day close
- ⏳ Offline close queue
- ⏳ Printed close report

---

### Phase F — POS Core ✅

Completed order types:
- Dine-in
- Take Away
- Drive Thru
- Delivery
- Quick Order

Completed backend:
- `dining_tables`
- `orders`
- `order_items`
- Branch + shift constraints
- Dine-in table requirement
- Table occupancy protection
- One active order per occupied table
- Order idempotency key
- Server-calculated order totals
- Create order command
- Add item command
- Change quantity command
- Remove item command
- Hold command
- Resume command
- Cancel command
- No direct client write permission to `orders` / `order_items`

Completed UI:
- Active orders list
- Order type selector
- Dine-in table selector
- Guest count
- Product tiles
- Quantity editing
- Item removal
- Hold / Resume / Cancel
- Occupied-table display
- Independent vertical scroll for product area
- Compact product tiles
- Guided message when no shift is open

Verify:
- ✅ Verify #40 passed Install + Typecheck + Build.

Deferred POS features:
- ⏳ Modifiers
- ⏳ Discounts
- ⏳ Split bill
- ⏳ Merge tables
- ⏳ Transfer table/order
- ⏳ Void / return
- ⏳ Receipt print / reprint
- ⏳ Customer display

---

## 4. Current phase — Kitchen / KDS 🚧

### Backend completed

Completed tables:
- ✅ `kitchen_tickets`
- ✅ `kitchen_ticket_items`

Completed contract:
- ✅ `products.inventory_item_id` added for ready-product stock mapping
- ✅ Product mapping and BOM are mutually exclusive
- ✅ `send_order_to_kitchen` is one atomic server transaction
- ✅ Kitchen send creates a delta ticket only for unsent changes
- ✅ `order_items.sent_quantity` tracks what has already reached kitchen
- ✅ Initial send cannot silently resend the same quantity
- ✅ Later quantity changes produce delta only
- ✅ Removing a previously sent item produces a negative delta
- ✅ Inventory deduction happens on kitchen send
- ✅ Negative kitchen delta reverses stock using `return_in`
- ✅ BOM product deducts component quantities
- ✅ Ready product deducts its direct mapped inventory item
- ✅ Product without BOM/direct mapping is rejected instead of deducting arbitrary stock
- ✅ Insufficient stock rejects the whole transaction atomically
- ✅ Kitchen ticket status command added
- ✅ Ticket transitions defined for queued -> preparing -> ready -> completed
- ✅ Order state follows kitchen state where applicable
- ✅ Security Advisor returned zero security lints after Kitchen DDL
- ✅ Missing kitchen FK indexes were added

### Frontend in progress

Already started:
- 🚧 POS service includes warehouse loading and `sendOrderToKitchen` command.
- 🚧 POS page is being updated so edits after first send remain local until a new kitchen delta is explicitly sent.

Still required to close Kitchen:
- ⏳ Finish POS button: **Send to Kitchen / Send Changes**
- ⏳ Require/select active warehouse before kitchen send
- ⏳ Show clear prerequisite when no warehouse exists
- ⏳ Show whether the order currently has an unsent kitchen delta
- ⏳ Add KDS service
- ⏳ Add KDS page
- ⏳ KDS counters inside POS header
- ⏳ KDS actions: Start / Ready / Complete
- ⏳ Verify order status synchronization
- ⏳ Verify stock movement created exactly once per delta
- ⏳ Verify removal after send reverses exact previous quantity
- ⏳ Verify cross-branch KDS access denied
- ⏳ Run Security Advisor + Performance Advisor after final Kitchen DDL
- ⏳ Run GitHub Verify and require Install + Typecheck + Build green

**Kitchen Definition of Done:**
- A real order can be created, products added, initial quantities sent once, stock deducted once, later edits sent as delta only, KDS transitions to ready, and no unauthorized branch can read or mutate the ticket.

---

## 5. Next phase — Payments ⏳

Planned schema:
- `payments`
- `payment_allocations`
- `refunds` / return payment records as needed

Required capabilities:
- Cash
- Card
- Split payment
- Partial payment
- Remaining balance
- Payment idempotency
- Payment permission: `pos.payment.take`
- Server-authoritative paid amount
- Order cannot become paid/closed without valid allocations
- Cash payment automatically affects active shift cash drawer
- Card payment does not inflate expected physical cash
- Payment and drawer movement must be atomic
- Refund/return path separated from normal payment

Planned state transitions:

```text
ready -> partially_paid -> paid -> closed
```

Rules:
- Payment is separate from order creation/editing.
- User may have payment permission without order creation permission.
- No client-computed authoritative payment balance.

Definition of Done:
- Exact total can be paid once or split across payment methods.
- Duplicate idempotency key cannot double-charge.
- Drawer expected cash matches cash payments/refunds.
- Unauthorized payment attempts fail closed.
- Verify green.

---

## 6. POS operational completion after Payments ⏳

### Discounts
- Permission-controlled discount command
- Percentage/fixed rules
- Reason/audit
- Approval threshold if configured

### Void / Cancel / Return
- Separate permissions
- Separate states and audit records
- Inventory reversal only when business rules require it
- Payment refund reconciliation
- Shift impact

### Split Bill
- Split order/payment allocation contract
- No duplicated quantities or revenue

### Table transfer / merge
- Transfer active dine-in order to available table
- Merge only through atomic command
- Preserve order identity and audit trail

### Printing
- First print permission
- Reprint separate permission
- Audit reprints

Definition of Done:
- Full cashier flow works without broad `pos.sell` permission.

---

## 7. Procurement / Purchasing ⏳

Planned:
- Suppliers
- Purchase documents
- Purchase lines
- Warehouse receipt
- Purchase status workflow
- Receipt increases stock atomically
- Purchase price/cost history
- Optional approval before receipt/payment

Definition of Done:
- Purchase -> Receive -> Inventory ledger is traceable and branch-scoped.

---

## 8. Waste, stock count & approvals ⏳

Planned:
- Waste document header + lines
- Warehouse selection mandatory
- Real inventory item selection
- Count session header + lines
- Count variance
- Approval center
- Self-approval forbidden unless explicit override permission
- Approval audit trail

Definition of Done:
- Sensitive stock changes have a document and approval trail, not only isolated movement rows.

---

## 9. Accounting & Treasury ⏳

Planned:
- Chart of accounts
- Journal entries
- Journal lines
- Expenses
- Cash/bank treasury accounts
- Business transaction linkage
- Idempotent automatic journal generation

Required outputs:
- Trial balance
- General ledger
- Income statement
- Balance sheet
- AR aging
- AP aging

Rules:
- Financial figures are server-authoritative.
- Every automatic journal must link to its source transaction.
- No duplicate posting on retries.

---

## 10. Reports ⏳

Final UX requirement:
- One consolidated professional Reports page
- No chart-first clutter
- Table-based data
- Totals
- Filters
- Custom columns
- Export to Excel
- Print

Required filters:
- Branch
- Date range
- Payment method
- Employee
- Product
- Order type
- Other report-specific dimensions

Report domains:
- Sales
- Sales by payment
- Sales by employee
- Sales by product
- Detailed invoices
- Purchases
- Expenses
- Profit
- Inventory
- Component consumption
- Recipe/BOM cost
- Top consumed inventory items
- Top selling products
- Low stock
- Cashier performance
- Returns
- Waste
- Accounting reports

Definition of Done:
- Data is branch-safe, server-authoritative, filterable and exportable without duplicated report screens.

---

## 11. Printing ⏳

Planned centralized printing module:
- Kitchen ticket
- Customer receipt
- Shift close
- Day close
- Report print

Rules:
- Business logic must not be scattered inside print components.
- First print and reprint are separately permissioned.
- Reprint is audited.

---

## 12. Offline critical operations ⏳

Scope is intentionally limited.

Required offline support:
- Shift close
- Day close
- Critical receipt/close printing as required

Required design:
- Local queue
- Idempotency key
- Retry handling
- Conflict strategy
- Visible pending/synced/error states

Do not attempt a broad offline clone of the whole ERP without a separate approved design.

---

## 13. Settings & administration UI ⏳

Planned:
- Branch management
- Warehouse management
- Users
- Roles
- Effective permissions
- User creation control
- Print settings
- POS settings
- Kitchen settings
- Guided setup checks

Rule:
- Settings UI never becomes a second authorization engine. Database/RPC authorization remains authoritative.

---

## 14. UI / UX finalization ⏳

Required final behavior:
- Arabic RTL primary
- English LTR secondary
- Sidebar fixed right in Arabic, left in English
- Mobile drawer
- Collapsible sidebar
- Touch-friendly controls
- Professional modern design
- iOS-inspired glass visual layer only after operational flows stabilize
- Loading / empty / error / unauthorized states
- Logical CSS properties where practical

Specific POS requirements:
- Compact product cards
- Product-area scroll always functional
- Delivery / pending / tables / KDS counters inside POS
- Functional layout on desktop and tablet

---

## 15. Automated verification plan ⏳

Every completed phase should eventually include:
- Typecheck
- Build
- Unit tests
- Database contract tests
- RLS/permission tests
- Integration tests
- E2E smoke

Critical security tests:
- Anonymous access denied
- Cross-branch reads denied
- Cross-branch commands denied
- Missing permission fails closed
- Role label alone grants nothing
- Only Super Admin gets implicit global bypass
- Branch manager cannot grant permissions outside allowed scope
- No user-ID spoofing in authorization helpers

Critical POS/Kitchen/Payment cycle:
1. Super Admin bootstrap
2. Create branch
3. Create warehouse
4. Create user
5. Grant branch + permissions
6. Create product
7. Create inventory item/BOM
8. Receive stock
9. Open shift
10. Create order
11. Add products
12. Send to kitchen
13. Verify stock deduction
14. Modify order
15. Send delta only
16. KDS preparing -> ready
17. Take split payment
18. Print receipt
19. Close order
20. Close shift
21. Verify reports/accounting
22. Attempt unauthorized cross-branch operations and ensure denial

---

## 16. Release gate ⏳

Do **not** merge to `main` until all are true:
- ⏳ Kitchen Done
- ⏳ Payments Done
- ⏳ POS operational completion Done
- ⏳ Procurement / stock controls Done
- ⏳ Accounting Done
- ⏳ Reports Done
- ⏳ Printing Done
- ⏳ Critical offline close Done
- ⏳ Full E2E cycle green
- ⏳ Security Advisor has no unresolved security lints
- ⏳ Performance Advisor has no unresolved missing FK indexes or material RLS warnings
- ⏳ GitHub Verify green on release candidate
- ⏳ No known P0/P1 regression
- ⏳ Explicit release approval

---

## 17. Current checkpoint

Current active checkpoint:

```text
Inventory mapping Verify #46 ✅
POS Core Verify #40 ✅
Shifts Verify #32 ✅
Kitchen backend ✅
Kitchen frontend / KDS 🚧
Next after Kitchen: Payments
```

When work continues, update this file in the **same commit group or immediately after the phase is verified** so it remains the canonical project build ledger.
