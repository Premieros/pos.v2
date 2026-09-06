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

### Pass 2.3 — Product categories + active order filtering ✅ IMPLEMENTED
- تصنيفات المنتجات أصبحت داخل POS مع عدد المنتجات لكل تصنيف.
- فلاتر الطلبات الحالية تعمل حسب نوع الطلب والحالة.
- حقول الطاولة/الضيوف تظهر فقط لنوع Dine-in؛ باقي الأنواع لا تحمل table context شكليًا.
- لا DDL لهذه الدفعة؛ استخدمت عقود categories/orders الحالية.

### Pass 2.4 — Customer / Delivery / Drive-Thru context ✅ BACKEND + POS INTEGRATED
Live migrations on locked project `scpovyrqmsbiduanykod`:
- `20260906070250_customer_delivery_context_contract`
- `20260906070420_harden_customer_delivery_indexes_and_rls`
- `20260906071253_enforce_kitchen_order_context_prerequisites`

Delivered:
- Branch-scoped customers and customer addresses with Permission-First/RLS contracts.
- Delivery order customer + delivery address context.
- Drive-thru operational reference context.
- Customer/address creation through RPCs; no direct frontend writes.
- Customer context component integrated into the active POS order.
- Server-side kitchen guard rejects Delivery without customer/address and Drive-Thru without reference even if UI is bypassed.
- Customer FK/index + RLS init-plan findings discovered by Advisor were fixed before acceptance.

Verified POS integration commit: `f9a651808f0dcb634ebe7dec524eca1508b76b88`
- CI #305 ✅
- Verify #668 ✅
- Release Guard #108 ✅

### Pass 2.5 — Product modifiers foundation 🔵 BACKEND COMPLETE / POS EDITOR BUILT / FINAL WIRING PENDING
Live migrations on locked project:
- `20260906071749_product_modifiers_foundation`
- `20260906071813_harden_product_modifiers_insert_and_stock_idempotency`
- `20260906072032_modifier_fk_covering_indexes`
- `20260906072121_enforce_required_modifiers_before_kitchen`

Backend contract now includes:
- Branch-scoped modifier groups with min/max selection rules.
- Modifier options with price delta and optional inventory-item consumption mapping.
- Product → modifier-group assignments.
- Order-line modifier snapshots preserving name/price/inventory quantity at sale time.
- `base_unit_price` + modifier price recalculation + order total recalculation.
- Atomic `set_order_item_modifiers` RPC guarded by `pos.order.edit`.
- Modifier editing is locked after first kitchen send. Correct operational change after send is remove/reverse line + add a new customized line, preserving KDS/stock lineage.
- Kitchen modifier stock consumption/restoration is generated from the same kitchen quantity delta and `source_order_item_id` lineage used by returns.
- Required modifier groups are enforced server-side before KDS ticket creation; UI bypass cannot send an incomplete product configuration.
- Insert trigger preserves compatibility with existing `add_pos_order_item` by deriving `base_unit_price` from `unit_price` for new lines.
- Modifier stock idempotency uses selection identity, preventing collisions when multiple options map to the same inventory item.

Review/hardening results:
- Initial Advisor found five new FK covering-index findings; all five were fixed in `20260906072032`.
- Performance Advisor now reports only expected unused-index INFO for the fresh/low-traffic database.
- Security Advisor remains unchanged: only external Auth warning `Leaked Password Protection Disabled`.

Frontend files built and typecheck-visible:
- `src/modules/modifiers/modifier.service.ts`
- `src/modules/modifiers/OrderItemModifierControls.tsx`
- `src/modules/modifiers/modifiers.css`

Current wiring task:
- Mount `OrderItemModifierControls` under each active order line in POS.
- Then verify full add → customize → kitchen → delta → return path against DEMO.
- Catalog-side modifier management must be built through server RPCs; direct authenticated table writes remain forbidden.

### Phase 2 UX layer ✅
- `src/styles/pos-phase2.css` remains the isolated POS functional UX layer.
- Search/F2/Clear + labeled order controls + active order cards + categories/filters + responsive fallbacks are independent from business authorization.

## Current parallel execution
1. Finish POS line modifier editor wiring and verify it.
2. Build Catalog modifier-management RPC contract + admin UI without direct table mutation.
3. Start product image/availability contract only after schema/security design review; no fake fields.
4. Refine checkout/payment workspace and split-tender UX over current server contracts.
5. Run full cashier E2E against retained `DEMO` dataset.
6. Keep Security + Performance Advisor green after every DDL batch.

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
