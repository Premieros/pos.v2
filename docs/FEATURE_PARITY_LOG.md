# POS.V2 — Feature Parity Execution Log

Repository: `Premieros/pos.v2`  
Branch: `development`  
Database lock: `scpovyrqmsbiduanykod`  
Reference: `Premieros/johna-s` — **READ ONLY / NO WRITES**

## Permanent rule
نأخذ من المرجع **التصميم وتجربة الاستخدام والمميزات فقط**. ممنوع نقل source code/CSS/SQL/migrations/services/hooks أو أخطاء/workarounds. ممنوع أي write/commit/workflow/Supabase على المرجع. كل التنفيذ داخل POS.V2 فقط.

## 2026-09-06 — Product completion program
ثبتت المراجعة أن POS.V2 قوي في backend/security contracts لكنه غير مكتمل كمنتج بصري وتشغيلي، لذلك الحالة Product Completion In Progress وليست Final.

## 2026-09-06 — Phase 1 Design Parity ✅ IMPLEMENTATION COMPLETE
تم تنفيذ App Shell + grouped navigation + Design System parity layers + POS/KDS/Reports/Catalog/Inventory/Procurement/Shifts/Admin/Printing visual productization، مع Responsive/RTL fallbacks.

Verified design implementation commit: `cadb8dbd16583fd0688c4d03bf704dd6a8d6cd00`
- CI #289 ✅
- Release Guard #76 ✅
- Verify #636 ✅
- Typecheck/Build ✅

تفاصيل التنفيذ في `docs/DESIGN_PARITY_LOG.md`.

## 2026-09-06 — Phase 2 POS Functional Completion — IN PROGRESS

### Pass 2.1 — Product search / SKU / Barcode ✅ IMPLEMENTED
استخدمنا الحقول الموجودة أصلًا في `products` ولم نضف DDL:
- POS product read contract يعرض `sku` و`barcode` بالإضافة للاسم العربي/الإنجليزي والسعر.
- البحث الفوري يطابق الاسم العربي أو الإنجليزي أو SKU أو Barcode.
- F2 يركز حقل البحث مباشرة.
- Enter على تطابق SKU/Barcode كامل يضيف المنتج إلى الطلب عبر نفس `add_pos_order_item` contract الحالي؛ لا يوجد bypass أو منطق بيع موازي.
- إظهار SKU داخل بطاقة المنتج عندما يكون موجودًا.
- حالة واضحة عند عدم وجود نتائج.

### Pass 2.2 — Order-start clarity ✅ IMPLEMENTED
- حقول نوع الطلب والطاولة وعدد الضيوف أصبحت مسماة بوضوح بدل bare controls.
- الزر الرئيسي أصبح «طلب جديد».
- حالات الطلب في قائمة الطلبات والطلب النشط أصبحت labels عربية مفهومة بدل raw database strings.
- Hold/Resume أصبحت «تعليق/استئناف» مع بقاء نفس RPCs والصلاحيات.
- قائمة الطلبات النشطة أصبحت mini-cards قابلة للمسح البصري تعرض رقم الطلب والنوع والحالة والإجمالي.

### Phase 2 UX layer ✅
- أنشئت `src/styles/pos-phase2.css` بعد طبقات Design Parity.
- أزيل عنوان المنتجات pseudo-element لصالح toolbar بحث حقيقي sticky.
- Search/F2/Clear + labeled order controls + active order cards + responsive fallbacks تم تنسيقها بدون تغيير business rules.

Functional implementation commit: `8dee75cd41b89771c2f7e253458c0166ef5634d1`
Verification:
- CI #292 ✅
- Release Guard #82 ✅
- Verify #642 ✅

Phase 2 styling enable checkpoint: `56b6169222d9733053e8b3fb4bc78df22d4c9517` — verification pending at time of this log update.

### Next parallel Phase 2 tracks
1. Product categories inside POS using current categories/product category_id contracts; no DDL expected.
2. Active-order filters/drawer behavior using existing order types/statuses.
3. Validate dine-in table + guest behavior and avoid irrelevant table selection for non-dine-in UX.
4. Inspect current schema before adding product images/availability; no fake fields.
5. Define clean contracts for modifiers, notes and customer context before any DDL.
6. Refine checkout/payment workspace and split-tender UX over existing server contracts.
7. Run full cashier E2E against retained `DEMO` dataset.

## Current 10-stage roadmap
1. Design Parity ✅ implementation complete.
2. POS Functional Completion 🔵 in progress.
3. Catalog & Customers.
4. Operations & KDS.
5. Inventory, Costing & Procurement.
6. Accounting & Treasury.
7. Reports & Audit.
8. Administration & System Control.
9. Hardening & Offline.
10. Full Product E2E / Release Candidate.

## Persistent test data
فرع `DEMO` وبياناته باقية ولا تحذف، وسيستخدم في الاختبارات المرحلية.
