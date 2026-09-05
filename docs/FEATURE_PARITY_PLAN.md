# POS.V2 — Clean-Room Feature Parity Plan

Repository: `Premieros/pos.v2`  
Implementation branch: `development`  
Locked Supabase project: `scpovyrqmsbiduanykod`  
Reference repository: `Premieros/johna-s` — **READ ONLY**

## Purpose
Complete POS.V2 as a production restaurant POS/ERP by reproducing useful **capabilities, workflows and UX concepts** observed in the reference project, while keeping POS.V2's own clean architecture, permission-first model, RLS, branch isolation and server-authoritative contracts.

This is **feature parity, not code migration**.

## Non-negotiable clean-room rule
1. Never copy source code, SQL, migrations, RPC bodies, CSS blocks, services, hooks or workarounds from the reference project.
2. Never push, edit, merge, run workflows, alter secrets or touch Supabase for the reference project.
3. Reference project is read-only evidence of desired capability and UX only.
4. Every capability must be re-specified as a POS.V2 contract before implementation.
5. A reference behavior that conflicts with POS.V2 security, branch isolation, accounting integrity, current inventory model or accepted requirements must be redesigned rather than copied.
6. Bugs, legacy coupling, role-label checks, insecure client mutations, duplicated workflows and obsolete modules are explicitly not portable.
7. Existing POS.V2 database identity lock remains mandatory: only `scpovyrqmsbiduanykod`.
8. Persistent `DEMO` data remains and is the canonical integration-test dataset unless an additional isolated test fixture is required.

## Acceptance filter for every referenced feature
A feature enters POS.V2 only if all are true:
- clear restaurant/business value;
- compatible with current POS.V2 product + inventory-unit/BOM model;
- permission key(s) defined before UI exposure;
- branch/warehouse scope explicit;
- server mutation atomic and idempotent when critical;
- RLS/fail-closed behavior preserved;
- loading/error/empty/unauthorized/offline behavior defined;
- Arabic RTL and responsive UX defined;
- no dependency on role names or visual placement;
- regression coverage added before declaring complete.

## Status vocabulary
- `KEEP` — already implemented correctly; polish/integration may remain.
- `REBUILD UX` — backend capability exists but presentation/workflow is not product-grade.
- `BUILD` — missing capability to implement cleanly.
- `ADAPT` — reference capability is useful but must fit POS.V2 architecture/model.
- `REJECT` — legacy/obsolete/incompatible capability; do not reproduce.

# Product Completion Batches

## Batch 11 — Application Shell, Navigation & Workspace Architecture
Goal: make POS.V2 feel like an application, not a stack of admin forms.

### 11.1 Real module navigation — `REBUILD UX`
- one active module at a time;
- route/deep-link state per module;
- browser back/forward behavior;
- active navigation state;
- grouped navigation sections;
- preserve permission-driven visibility;
- mobile drawer and desktop collapse.

### 11.2 Compact global header — `REBUILD UX`
- target compact desktop header (~56–64 px class of density);
- current branch and branch switcher;
- online/offline state;
- pending sync/offline intents;
- current user/menu;
- locale RTL/LTR;
- optional contextual back action;
- no oversized marketing-style page headers in operational screens.

### 11.3 Command/quick navigation — `BUILD`
- keyboard-friendly command palette / quick search;
- jump to permitted modules/actions only;
- POS hotkeys must not bypass permissions.

### 11.4 Notification/action surfaces — `BUILD/ADAPT`
- approvals inbox indicator;
- open orders indicator;
- KDS queue indicator;
- low-stock indicator where authorized;
- no duplicated dashboard counters disconnected from source data.

**Exit gate:** navigation regression, responsive shell, RTL/LTR, permission visibility, deep-link behavior.

---

## Batch 12 — POS Fullscreen Rebuild (Highest Priority)
Goal: cashier-first POS workspace using existing POS.V2 contracts, with missing contracts added cleanly.

### 12.1 POS dedicated fullscreen shell — `REBUILD UX`
- POS gets its own compact top bar and workspace density;
- no generic admin header consuming selling area;
- persistent current-order/cart region;
- persistent catalog region;
- active orders/tables/KDS access from POS top bar;
- keyboard/touch optimized.

### 12.2 Order start flow — `REBUILD UX`
Supported types retained:
- Dine-in;
- Take Away;
- Drive Thru;
- Delivery;
- Quick Order.

Add/rebuild:
- fast visible type selector;
- dine-in table + guest selection;
- delivery/customer prerequisite flow;
- drive-thru vehicle/reference fields where business value is confirmed;
- guided prerequisite routing instead of raw errors.

### 12.3 Product catalog/browser — `BUILD + REBUILD UX`
- category tabs with counts;
- search by Arabic/English name;
- SKU search;
- barcode field/scanner keyboard flow;
- configurable keyboard shortcut (reference-style F2 behavior may be adapted);
- product images with safe fallback;
- price clearly visible;
- stock/availability state;
- disabled/unavailable product behavior;
- dense touch-friendly grid;
- independent scrolling from cart;
- no accidental whole-page scroll.

### 12.4 Cart / current order — `REBUILD UX`
- clear item rows;
- quantity +/- controls;
- direct quantity edit where permitted;
- remove before kitchen;
- void semantics after kitchen;
- sent vs unsent state per line;
- line notes;
- item subtotal and order total;
- selected item state for item actions;
- visible order status and kitchen status.

### 12.5 Product modifiers/options — `BUILD`
- modifier groups;
- required/optional groups;
- min/max selections;
- price deltas;
- per-line modifier snapshot;
- kitchen-visible modifier text;
- return/receipt snapshot integrity;
- product-to-modifier assignment;
- permission-controlled catalog management.

### 12.6 Order notes / item notes — `BUILD/ADAPT`
- order-level note;
- line-level kitchen note;
- audit-safe edit rules after kitchen send.

### 12.7 Kitchen send workflow — `KEEP + REBUILD UX`
Existing delta contract remains canonical.
Improve UX:
- primary Send to Kitchen button;
- explicit first-send vs send-changes state;
- warehouse/station routing surfaced only when operationally needed;
- synchronized/pending-delta indicator;
- prevent duplicate semantic sends.

### 12.8 Active orders drawer/panel — `BUILD/REBUILD UX`
- filters by type/status;
- held orders;
- delivery queue;
- drive-thru queue;
- dine-in table context;
- resume/select order without leaving POS;
- fast counts in top bar.

### 12.9 Table/floor workspace — `BUILD/ADAPT`
- floor/area tabs;
- available/occupied/awaiting-payment state;
- guest count;
- table order link;
- transfer table;
- merge tables/orders using current merge contract;
- touch-friendly visual floor layout;
- drag/drop layout editor only if isolated from order logic and permission controlled.

### 12.10 Discounts — `KEEP + REBUILD UX`
- percentage/fixed;
- reason;
- permission gate;
- clear summary;
- no discount after forbidden payment state;
- audit trail retained.

### 12.11 Split Bill — `KEEP + REBUILD UX`
- split equally;
- split by items/quantity where contract supports it;
- clear split cards;
- independent payment state;
- no hidden duplicated totals.

### 12.12 Checkout / Payment workspace — `REBUILD UX + ADAPT`
- dedicated checkout view/drawer/modal sized for POS;
- summary: subtotal, discounts, tax if configured, total, paid, remaining;
- Cash;
- Card;
- Split Tender;
- additional payment methods only after explicit POS.V2 contract/configuration;
- numeric keypad/touch controls where useful;
- cash received/change calculation;
- customer context;
- table/delivery/drive-thru context;
- close order only after server-confirmed paid state.

### 12.13 Customer display — `KEEP + REBUILD UX`
- clear launch/control;
- live authorized projection only;
- no internal permissions/stock data leakage.

### 12.14 Receipt / printing — `KEEP + REBUILD UX`
- first print;
- controlled reprint + reason;
- receipt preview;
- printer settings later in Admin batch;
- immutable snapshot retained.

### 12.15 POS keyboard shortcuts — `BUILD`
Candidate shortcuts:
- product search/barcode focus;
- new order;
- send kitchen;
- checkout;
- hold/resume;
- active orders.
All shortcuts call same permission-checked actions; never parallel logic.

### 12.16 POS offline indicators — `ADAPT`
- current connectivity;
- pending offline close intents;
- explicitly distinguish operations that remain online-only;
- never fake kitchen/payment/final server state offline.

**Exit gate:** full cashier E2E on DEMO: create → add/modifiers → kitchen → modify/delta → ready → split/payment → receipt → close + hold/resume + table flows + denial tests.

---

## Batch 13 — Catalog, Customers & Commercial Setup

### 13.1 Product management — `KEEP + REBUILD UX`
- product image;
- Arabic/English name;
- SKU/barcode;
- category;
- price;
- active/sellable;
- stock mapping/BOM configuration;
- searchable table/grid;
- product setup wizard for guided creation.

### 13.2 Categories — `KEEP + REBUILD UX`
- ordering/sort priority;
- active state;
- POS display behavior.

### 13.3 Modifier administration — `BUILD`
Corresponding to 12.5.

### 13.4 Kitchen stations/routing — `ADAPT`
- station definitions if required by real KDS routing;
- product/category → station mapping;
- do not copy any brittle station implementation from reference;
- retain exact order-item lineage.

### 13.5 Customers — `BUILD`
- customer profile;
- phone/search;
- addresses;
- delivery notes;
- order history summary;
- branch scope/privacy rules;
- customer selection inside POS.

### 13.6 Pricing/tax settings — `BUILD/ADAPT`
- branch-level tax/service configuration only if business requirements require it;
- tax calculations server-authoritative;
- receipt/accounting integration required before enabling.

**Explicitly rejected:** subscription product/module from legacy reference unless user later reintroduces it as a new requirement.

---

## Batch 14 — Operations Center

### 14.1 Operational home/dashboard — `BUILD/REBUILD UX`
- actionable operational summary, not decorative charts;
- open orders;
- KDS queue;
- shifts;
- low stock;
- pending approvals;
- purchasing arrivals;
- quick permitted actions.

### 14.2 KDS productization — `KEEP + REBUILD UX`
- station/status filters;
- aging timer;
- priority state;
- preparing → ready;
- completed history window;
- clear delta/modification ticket treatment;
- optional sound/visual alert preference;
- fullscreen kitchen mode.

### 14.3 Queue views — `BUILD/ADAPT`
- take-away queue;
- drive-thru queue;
- delivery queue;
- ready-for-pickup visibility;
- source remains order/KDS state, not duplicated mutable tables unless contract requires it.

### 14.4 Shift workspace — `KEEP + REBUILD UX`
- open shift;
- opening balance;
- cash in/out;
- expected vs actual;
- sales/payment/discount/return/void summary;
- offline pending close state;
- print close report;
- historical shift list.

---

## Batch 15 — Inventory, Costing & Procurement Completion

### 15.1 Inventory center — `KEEP + REBUILD UX`
- balances by warehouse;
- item ledger;
- movements;
- transfers;
- receive;
- adjustments;
- low-stock view;
- branch/warehouse filters.

### 15.2 Inventory valuation — `BUILD/ADAPT`
- valuation report from accepted cost history/model;
- no invented mutable balance/cost shortcuts.

### 15.3 Costing center — `BUILD/ADAPT`
- product/BOM cost;
- component contribution;
- purchase cost history;
- margin estimate;
- variance indicators;
- must fit current product-components + inventory-item model.

### 15.4 Waste center — `KEEP + REBUILD UX`
- warehouse;
- inventory item;
- quantity;
- reason;
- document lifecycle/history;
- posted stock lineage.

### 15.5 Stock count — `KEEP + REBUILD UX`
- new session;
- count entry;
- variance preview;
- submit/review/approval;
- post adjustment;
- history.

### 15.6 Procurement center — `KEEP + REBUILD UX`
- suppliers;
- purchase orders;
- statuses;
- partial receiving if contract is extended safely;
- receipt history;
- unit cost history;
- open/pending orders dashboard;
- cancellation/approval where configured.

### 15.7 Import / Export — `BUILD`
- catalog import template;
- inventory opening/import only through validated server commands;
- export products/inventory/suppliers/reports;
- validation preview before mutation;
- branch scope mandatory;
- no raw unrestricted SQL/data overwrite path.

### Legacy manufacturing policy — `REJECT / TRANSLATE CAPABILITY`
Do **not** restore the old raw-material/manufacturing subsystem merely because it exists in the reference project. Useful business outcomes (recipe/BOM cost, component consumption, waste, stock movement) are implemented through POS.V2's accepted product + inventory-item/BOM model. Any future actual production/manufacturing module requires a new explicit product decision.

---

## Batch 16 — Accounting, Treasury & Reconciliation Productization

### 16.1 Chart of Accounts — `KEEP + REBUILD UX`
- hierarchy/tree presentation;
- create/edit rules;
- posting/non-posting status;
- branch scope.

### 16.2 Journals — `KEEP + REBUILD UX`
- draft editor;
- balanced validation;
- post;
- reversal;
- source linkage;
- searchable history.

### 16.3 Expenses — `KEEP + REBUILD UX`
- draft/post lifecycle;
- payee/reference;
- source journal;
- filters/history.

### 16.4 Treasury/banks — `KEEP + REBUILD UX`
- cash/bank accounts;
- movements;
- linked journals;
- balances from ledger/source data.

### 16.5 Reconciliation — `BUILD/ADAPT`
- compare treasury/payment records to accounting entries;
- discrepancy list;
- investigation workflow;
- no auto-fix that weakens audit trail.

### 16.6 Operational posting center — `KEEP + REBUILD UX`
- failed/pending source postings;
- retry where safe;
- source drilldown;
- explicit error state.

---

## Batch 17 — Reports & Management Information

### 17.1 Unified Reports — `KEEP + REBUILD UX`
Retain table-first/no-chart principle unless explicitly changed.
- compact filters;
- sticky headers;
- saved visible columns locally;
- totals visible without excessive scrolling;
- Excel export;
- print mode;
- empty/error states.

### 17.2 Sales/operations
- sales;
- invoices;
- payment methods;
- employee/cashier;
- product;
- order type;
- returns/refunds;
- discounts/voids;
- shift/day summaries;
- KDS operational metrics where meaningful.

### 17.3 Inventory/procurement/cost
- balances;
- ledger/movement history;
- low stock;
- waste;
- stock count variance;
- purchases;
- supplier purchases;
- purchase cost history;
- BOM/product cost;
- margin/cost views.

### 17.4 Accounting
- trial balance;
- general ledger;
- income statement;
- balance sheet;
- expenses;
- treasury movements;
- reconciliation discrepancies.

### 17.5 Audit report — `BUILD`
- permission/role/user changes;
- critical order actions;
- reprints;
- voids/returns;
- stock adjustments;
- approvals;
- posting/reversal actions.

---

## Batch 18 — Administration & System Control Center

### 18.1 Branches — `KEEP + REBUILD UX`
### 18.2 Warehouses — `KEEP + REBUILD UX`
### 18.3 Users — `KEEP + REBUILD UX`
### 18.4 Branch access — `KEEP + REBUILD UX`
### 18.5 Role templates — `KEEP + REBUILD UX`
### 18.6 Direct permission grants/revokes — `KEEP + REBUILD UX`
### 18.7 Protected Super Admin — `KEEP`
Must remain hidden, immutable and untargetable by ordinary management workflows.

### 18.8 System settings center — `BUILD/ADAPT`
- locale/default language;
- printing preferences;
- POS behavior preferences;
- receipt settings;
- kitchen display preferences;
- allowed payment methods;
- operational numbering/reference settings where needed;
- user creation policy toggle if required by accepted requirements.

### 18.9 System health / diagnostics — `BUILD/ADAPT`
- public configuration presence;
- connectivity state;
- migration/application version info safe for admins;
- offline queue status;
- no secret values displayed.

### 18.10 Data management — `BUILD/ADAPT`
- controlled import/export;
- no destructive reset/cleanup actions exposed casually;
- persistent DEMO data must not be removable without explicit authorized workflow/user request.

**Explicitly rejected:** legacy subscription administration unless separately approved as a new module.

---

## Batch 19 — Cross-Cutting Product Quality

### 19.1 Search and keyboard accessibility
### 19.2 Touch target consistency
### 19.3 Responsive tablet/mobile behavior
### 19.4 RTL/LTR visual QA
### 19.5 Loading/error/empty/unauthorized states everywhere
### 19.6 Toast/action feedback system
### 19.7 Confirmation patterns for destructive actions
### 19.8 Consistent date/time/money formatting
### 19.9 Optimistic UI only where rollback/error semantics are safe
### 19.10 Offline boundaries documented per action
### 19.11 Print layouts
### 19.12 Product image storage/fallback
### 19.13 Auditability of critical actions

---

## Batch 20 — Full Feature-Parity Verification & Production Gate

### Functional E2E
- Super Admin/admin setup;
- branch + warehouse;
- normal user + branch access + permissions;
- category/product/image/barcode/modifiers/BOM;
- stock receipt;
- shift open;
- all five POS order types;
- customer/delivery flow;
- table occupancy/transfer/merge;
- product search/barcode;
- item modifier/note;
- hold/resume;
- kitchen first send + delta send;
- KDS prepare/ready;
- discount;
- split bill + split tender;
- receipt first print/reprint;
- return/refund/restock;
- shift cash movement + close/offline retry;
- suppliers + PO + receipt + cost history;
- waste + stock count + approval;
- accounting posting + reversal;
- treasury + reconciliation;
- all report families;
- import/export validation.

### Security E2E
- anonymous denied;
- branch isolation;
- warehouse scope;
- missing permission fails closed;
- role label alone grants nothing;
- protected Super Admin cannot be listed/edited through ordinary admin paths;
- ordinary manager cannot grant permissions they do not hold;
- no user-id spoofing;
- no service-role/public secret leakage;
- public wrappers/private internals remain callable only through intended contract.

### Release gate
- all regression guards green;
- Typecheck + Build green;
- Pages preview green;
- Security Advisor has no material schema/code finding;
- Performance Advisor reviewed;
- DEMO full-cycle test green;
- visual QA on desktop/tablet/mobile and RTL/LTR;
- `main` merge only after explicit user approval.

# Reference capability policy
The reference repository may contain features that are duplicate, obsolete, unfinished or architecturally unsafe. Their existence is not proof they should be copied. The target is **capability parity at higher quality**, not source parity.

When uncertain, record the feature in `docs/FEATURE_PARITY_LOG.md`, classify it, define a clean POS.V2 contract, then implement only after the contract is accepted by existing architecture and tests.
