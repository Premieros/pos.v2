# POS.V2 — Product Completion & Feature Parity Plan

Repository: `Premieros/pos.v2`  
Implementation branch: `development`  
Locked Supabase project: `scpovyrqmsbiduanykod`  
Reference repository: `Premieros/johna-s` — **READ ONLY**

## القاعدة الثابتة
- المرجع قراءة فقط: لا تعديل/Commit/Workflow/Supabase عليه.
- نعيد إنتاج التصميم والمميزات، لا ننقل source code أو SQL أو migrations أو bugs/workarounds.
- **نسخ التصميم وتجربة الاستخدام هو المرحلة الأولى قبل إضافة المميزات.**
- مطابقة الشكل لا تسمح بتغيير business logic/permissions/RLS.
- كل ميزة لاحقة يعاد تنفيذها بعقد POS.V2 مستقل.
- قاعدة البيانات الوحيدة `scpovyrqmsbiduanykod`، وبيانات `DEMO` لا تحذف.

# مراحل العمل

## المرحلة 1 — Design Parity / نسخ التصميم وتجربة الاستخدام — CURRENT
### 1.1 Design inventory
حصر أنماط المرجع: App Shell, Sidebar, Header, Cards, Forms, Tables, Drawers, Dialogs, Tabs, Filters, States, POS, KDS, Reports, Settings.

### 1.2 Global App Shell
- Sidebar احترافي منظم في مجموعات؛ RTL يمين وLTR يسار.
- Header تشغيلي صغير 56–64px تقريبًا.
- branch/user/language/connectivity/quick actions.
- module واحد فقط في workspace.
- desktop collapse + mobile drawer.
- لا تداخل أو تكديس شاشات.

### 1.3 Global Design System
إعادة بناء tokens/components داخل POS.V2: spacing, typography, radius, shadows, surfaces, buttons, inputs, search, cards, toolbars, tabs, tables, filters, dialogs, drawers, badges, loading/empty/error/unauthorized, focus/touch/keyboard, responsive + RTL/LTR.

### 1.4 POS visual clone — الأولوية الأعلى
إعادة إنتاج تكوين وتجربة POS المرجعية بصريًا باستخدام منطق POS.V2 الحالي:
- fullscreen POS shell;
- compact POS top bar + counters/quick actions;
- catalog كبير واضح + search/category strip;
- product tiles بصور/اسم/سعر/availability;
- cart/current-order panel ثابت;
- order type/table/customer context;
- item rows + quantity/actions;
- totals/action footer;
- active orders/tables/KDS surfaces;
- checkout/payment surface منفصل;
- independent catalog/cart scrolling;
- touch-first density.

في هذه المرحلة لا نخترع Backend. الوظائف التي تحتاج عقدًا جديدًا تبقى hidden/disabled حتى مرحلتها الوظيفية.

### 1.5 KDS / Operations visual parity
Fullscreen KDS، ticket hierarchy/timers/status، queues، shifts layout، responsive kitchen display.

### 1.6 Back-office visual parity
توحيد Catalog/Inventory/Procurement/Accounting/Reports/Admin: page header صغير، filter/action toolbar، table-first workspace، drawers/dialogs للنماذج، sticky totals/actions، وعدم تكديس وظائف في صفحة طويلة.

### 1.7 Design gate
Desktop 1440/1280 + tablet + mobile، Arabic RTL + English LTR، POS no-overlap/no-whole-page-scroll، module واحد فقط، consistency audit، Typecheck + Build + Verify green.

---
## المرحلة 2 — POS Functional Completion
Order types، name/SKU/barcode search، availability، modifiers، notes، active orders/hold-resume، floor/tables/guests، kitchen first-send + delta، discounts، split bill، transfer/merge، customers، checkout، Cash/Card/Split Tender، customer display، receipt/reprint، shortcuts، connectivity. Exit: full cashier E2E on DEMO + denial tests.

---
## المرحلة 3 — Catalog & Customers
Product images، bilingual names، SKU/barcode، categories ordering، guided setup، modifier admin، kitchen routing عند الحاجة، customers/phones/addresses/delivery context. Subscription remains rejected unless explicitly reintroduced.

---
## المرحلة 4 — Operations & KDS
Operations dashboard، productized KDS، takeaway/drive-thru/delivery queues، shifts، operational indicators.

---
## المرحلة 5 — Inventory, Costing & Procurement
Balances/ledger/movements/transfers/receive/adjust/low stock، valuation، BOM costing/margin، waste، stock count/approval، suppliers/purchases/receipts/cost history، validated import/export. لا استعادة legacy raw-material/manufacturing؛ النتائج المفيدة تُبنى على inventory-item + BOM.

---
## المرحلة 6 — Accounting & Treasury
COA، journals/post/reversal، expenses، treasury/banks، reconciliation، posting diagnostics، financial statements.

---
## المرحلة 7 — Reports & Audit
Unified table-first reports، compact filters/sticky totals، custom columns، Excel/print، sales/operations، inventory/procurement/cost، accounting، critical-action audit.

---
## المرحلة 8 — Administration & System Control
Branches، warehouses، users/branch access، role templates/direct permissions، protected Super Admin، POS/KDS/printing preferences، system health، controlled data management.

---
## المرحلة 9 — Hardening & Offline
Responsive/touch/accessibility، RTL/LTR، keyboard workflow، offline critical-close resilience، unified states، performance، shortcut permission safety.

---
## المرحلة 10 — Full Product E2E / Release Candidate
DEMO full cycle: branch → warehouse → user → permissions → product/BOM → receive → shift → order → kitchen → delta → KDS → split/payment → receipt → close → return/refund → shift close → procurement → accounting → reports → cross-branch denial.

Final: regression guards + Typecheck/Build/Verify/Deploy + Advisors + no P0/P1 + explicit approval before `development` → `main`.

## Current execution order
**NOW: Phase 1 Design Parity** → Global shell/design system → POS visual clone → KDS/operations visual clone → back-office visual unification → responsive/RTL verification → then Phase 2.
