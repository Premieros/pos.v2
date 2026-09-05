# POS.V2 — Feature Parity Execution Log

Repository: `Premieros/pos.v2`  
Branch: `development`  
Database lock: `scpovyrqmsbiduanykod`  
Reference: `Premieros/johna-s` — **READ ONLY / NO WRITES**

## Permanent rule
This log records **capabilities to reproduce**, never code to copy.

Forbidden actions against the reference project:
- no file edits;
- no commits/merges;
- no workflow runs/re-runs;
- no Supabase access or schema/data changes;
- no migration copying;
- no secret/environment reuse;
- no direct source/CSS/service/hook copying.

All implementation happens only in POS.V2 after rewriting the requirement as an independent POS.V2 contract.

## 2026-09-06 — Feature parity program opened

### Trigger
Visual and operational review showed that POS.V2 has a strong backend/security foundation but remains significantly behind the reference project in product UX depth and several operational capabilities, especially POS.

### Decision
Previous Batches 1–10 remain historically closed for the contracts they delivered, but the product is **not Final**. Release status is reopened as **Product Completion In Progress**.

A new program begins at Batch 11 and is governed by `docs/FEATURE_PARITY_PLAN.md`.

### Reference observations accepted as capability targets

#### Application shell / navigation
- true one-module-at-a-time workspace;
- compact operational header;
- grouped navigation;
- branch context;
- connectivity/offline visibility;
- active-order/KDS/approval quick indicators;
- command/quick navigation concept.

#### POS
- dedicated fullscreen POS workspace;
- compact POS top bar;
- fast new-order workflow;
- all order types visible and easy to select;
- active orders panel;
- dine-in tables/floor access;
- product browser with categories;
- search by name/SKU/barcode;
- product images;
- stock/availability on tiles;
- cart-oriented current-order UI;
- quantity +/- and item actions;
- line/order notes;
- modifiers/options;
- clear sent/unsent kitchen state;
- kitchen delta-send UX;
- hold/resume;
- discounts;
- split bill;
- table transfer/merge;
- dedicated checkout/payment workspace;
- cash/card/split tender;
- customer context;
- customer display;
- receipt/reprint;
- POS keyboard shortcuts;
- visible online/offline state.

#### Catalog / commercial setup
- product images;
- barcode/SKU management;
- guided product setup;
- categories with ordering/display behavior;
- modifier administration;
- kitchen station/routing concept;
- customers + addresses/order context.

#### Operations
- actionable operations dashboard;
- KDS fullscreen/productized workflow;
- takeaway/drive-thru/delivery queue views;
- shift workspace with operational summary and print.

#### Inventory / costing / procurement
- inventory center with balance/ledger/movements/transfers;
- low-stock view;
- valuation;
- costing center/BOM cost/margin;
- waste center;
- stock count + variance + approval;
- procurement center with supplier/order/receipt/cost history;
- controlled import/export.

#### Accounting
- account tree/productized chart of accounts;
- journal editor/history;
- expenses;
- treasury/banks;
- reconciliation capability;
- operational posting diagnostics/retry;
- financial statements.

#### Reporting
- unified reports;
- sales/operations reports;
- inventory/procurement/cost reports;
- accounting reports;
- audit reporting;
- custom columns/export/print retained.

#### Administration
- branches;
- warehouses;
- users;
- branch access;
- roles and direct permissions;
- protected Super Admin;
- system settings center;
- printing/POS/KDS preferences;
- system health/diagnostics;
- controlled data management.

### Explicitly not copied from reference
- source code of any kind;
- migrations/RPC implementations;
- legacy role-label authorization;
- client-side security assumptions;
- duplicated or brittle state models;
- subscription module unless explicitly reintroduced later;
- old manufacturing/raw-material subsystem merely for parity;
- any bug/workaround whose behavior is not independently justified.

### Translation rule for incompatible legacy capabilities
When the reference implements a useful business outcome through an obsolete model, reproduce the **outcome** through POS.V2 architecture. Example: recipe costing/component consumption remains based on POS.V2 `product_components` + inventory items; this does not authorize restoration of legacy raw-material/manufacturing tables.

### Current priority
**Batch 11 → Batch 12 POS rebuild** is the immediate execution path.

Before any new database DDL:
1. verify repository = `Premieros/pos.v2`;
2. verify branch = `development`;
3. verify Supabase project ref = `scpovyrqmsbiduanykod`;
4. define permission/branch/RLS contract;
5. add forward-only migration only if current schema cannot support the capability.

### Existing persistent test data
The `DEMO` branch dataset remains retained and will be expanded only as needed to exercise new features. It must not be deleted.
