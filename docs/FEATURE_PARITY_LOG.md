# POS.V2 — Feature Parity Execution Log

Repository: `Premieros/pos.v2`  
Branch: `development`  
Database lock: `scpovyrqmsbiduanykod`  
Reference: `Premieros/johna-s` — **READ ONLY / NO WRITES**

## Permanent rule
نأخذ من المرجع **التصميم وتجربة الاستخدام والمميزات فقط**. ممنوع نقل source code/CSS/SQL/migrations/services/hooks أو أخطاء/workarounds. ممنوع أي write/commit/workflow/Supabase على المرجع. كل التنفيذ داخل POS.V2 فقط.

## 2026-09-06 — Product completion program
ثبتت المراجعة أن POS.V2 قوي في backend/security contracts لكنه غير مكتمل كمنتج بصري وتشغيلي، لذلك الحالة Product Completion In Progress وليست Final.

## 2026-09-06 — User priority changed: DESIGN FIRST
قرار المستخدم: **نسخ التصميم هو المرحلة الأولى قبل نسخ/إضافة المميزات.**

تمت إعادة ترتيب `docs/FEATURE_PARITY_PLAN.md` إلى عشر مراحل واضحة:
1. Design Parity — CURRENT.
2. POS Functional Completion.
3. Catalog & Customers.
4. Operations & KDS.
5. Inventory, Costing & Procurement.
6. Accounting & Treasury.
7. Reports & Audit.
8. Administration & System Control.
9. Hardening & Offline.
10. Full Product E2E / Release Candidate.

### Phase 1 execution order
1. Global App Shell + compact header/sidebar/navigation.
2. Global Design System.
3. POS visual clone — highest priority.
4. KDS/Operations visual clone.
5. Back-office visual unification.
6. Responsive + RTL/LTR design verification.

### Meaning of “copy design”
نستهدف نفس جودة وتكوين وكثافة وتجربة الواجهة المرجعية: توزيع المناطق، hierarchy، navigation، POS workspace، product catalog/cart/checkout surfaces، tables/forms/toolbars/dialogs. لكن التنفيذ يعاد كتابته داخل POS.V2؛ لا نسخ حرفي لمكونات أو CSS المرجع.

### Safety boundary
مطابقة التصميم لا تغير authorization/business logic/RLS. أي control بصري يعتمد على ميزة غير موجودة لن يحصل على fake logic؛ يظل hidden/disabled إلى أن تبنى الميزة في مرحلتها.

### Design exit gate
Desktop/tablet/mobile + Arabic RTL/English LTR + no overlap + no stacked modules + independent POS scrolling + consistency audit + Typecheck/Build/Verify green.

## Reference capability backlog after design
بعد إغلاق التصميم تبدأ المميزات: POS order flow/search/barcode/modifiers/customers/floor/queues/checkout، ثم catalog/customers، operations/KDS، inventory/costing/procurement، accounting/reconciliation، reports/audit، admin/settings، hardening، وأخيرًا E2E شامل.

## Persistent test data
فرع `DEMO` وبياناته باقية ولا تحذف، وسيستخدم في الاختبارات المرحلية.
