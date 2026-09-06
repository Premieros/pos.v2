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

### Pass 2.5 — Product modifiers ✅ BACKEND + POS + CATALOG IMPLEMENTED
Live migrations on locked project:
- `20260906071749_product_modifiers_foundation`
- `20260906071813_harden_product_modifiers_insert_and_stock_idempotency`
- `20260906072032_modifier_fk_covering_indexes`
- `20260906072121_enforce_required_modifiers_before_kitchen`
- `20260906072555_modifier_catalog_management_commands`

Backend contract:
- Branch-scoped modifier groups with min/max selection rules.
- Modifier options with price delta and optional inventory-item consumption mapping.
- Product → modifier-group assignments.
- Order-line snapshots preserving option name/price/inventory quantity.
- `base_unit_price` + modifier price recalculation + order total recalculation.
- Atomic `set_order_item_modifiers` RPC guarded by `pos.order.edit`.
- Editing locks after first kitchen send; operational change after send is reverse/remove line then add a new customized line.
- Kitchen stock consumption/restoration follows the same quantity delta + source order-item lineage used by returns.
- Required modifier groups are enforced server-side before KDS ticket creation.
- Insert compatibility derives `base_unit_price` from the line unit price.
- Modifier stock idempotency includes the modifier selection identity, avoiding collisions when several options map to the same inventory item.
- Catalog management uses Permission-First RPCs guarded by `catalog.manage`; no new direct authenticated writes were introduced for modifier mutations.

Review/hardening:
- Five FK covering-index findings were discovered and fixed before acceptance.
- Performance Advisor returned to expected unused-index INFO only.
- Security Advisor remained unchanged except external Auth warning `Leaked Password Protection Disabled`.

POS wiring completed:
- `OrderItemModifierControls` is mounted below each active POS line.
- Each line shows current selections and price delta.
- Required/min/max validation exists in UI and server.
- After kitchen send the editor is read-only and explains the correct replacement-line workflow.
- POS line refresh recalculates totals after modifier save.

Catalog management completed:
- `ModifierCatalogPanel` integrated into `CatalogPage`.
- Create modifier group.
- Create modifier option.
- Optional Inventory Item + quantity consumption mapping.
- Assign/unassign modifier groups per product.
- Group and option summaries are visible in the catalog workspace.
- Responsive CSS added for POS modifier editor and catalog management.

Implementation checkpoints:
- POS line wiring: `c89c4f9c73acb5df98196a8e9b905f341d91c564`
- Modifier management service: `33883d896f452b007bc24447f0c24515641057d7`
- Catalog modifier panel: `ae84afddf664d66ae34e9df988fd52d84bf3f006`
- Catalog integration: `fa7492bc979e196954f00f927dd2b59c42feaa46`
- Styling checkpoint: `8976a709896200440b05dccea69d0be8efac1034`

Verification for the latest styling/catalog HEAD is running at the time of this log entry; Build already passed. Do not mark this pass verified until CI/Verify/Release Guard finish green.

### Phase 2 UX layer ✅
- `src/styles/pos-phase2.css` remains the isolated POS functional UX layer.
- Search/F2/Clear + labeled order controls + active order cards + categories/filters + responsive fallbacks are independent from business authorization.
- Modifier UI is isolated in `src/modules/modifiers/modifiers.css` and does not move permission/business rules into layout.

## Current parallel execution
1. Verify modifier POS/catalog integration on the latest HEAD.
2. Add persistent DEMO modifier groups/options/product assignment only after the code pass is green.
3. Run full add → customize → kitchen → KDS delta → return lineage test on retained DEMO data.
4. Review product image/availability contract next; no fake UI fields.
5. Refine checkout/payment workspace and split-tender UX over current server contracts.
6. Continue Security + Performance Advisor review after every DDL batch.

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
