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

### Pass 2.5 — Product modifiers ✅ VERIFIED
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
- Verified styling/catalog code checkpoint: `8976a709896200440b05dccea69d0be8efac1034`

Verification on `8976a709...`:
- Build ✅
- Repository contract ✅
- Frontend/Verify checks ✅
- GitHub Pages deploy ✅
- No failing check detected.

Persistent DEMO modifier dataset added on branch `DEMO` without deleting prior data:
- Required group `DEMO-BURGER-STYLE`: متوسط / تسوية كاملة.
- Optional group `DEMO-BURGER-EXTRAS`: جبنة إضافية +15 linked to DEMO cheese inventory; لحم إضافي +35 linked to DEMO beef inventory.
- Both groups assigned to `DEMO-BRG-01` / كلاسيك برجر.

Transactional DEMO smoke test (rolled back, no temporary order persisted):
1. Create Quick order with Classic Burger.
2. Kitchen send without required style → correctly blocked ✅.
3. Select `متوسط` + `جبنة إضافية`.
4. Line price changed from 95.00 → 110.00 ✅.
5. Order total became 110.00 ✅.
6. Kitchen ticket created successfully ✅.
7. Extra cheese stock delta recorded as `-1.000000` on the source order line ✅.
8. Test transaction rolled back; permanent DEMO modifier configuration remains.

Review note: initial smoke used the DEMO kitchen warehouse and correctly failed because that warehouse has zero cheese/beef. We did not fabricate stock to make the test pass. The successful smoke used the DEMO main warehouse where the actual inventory balances exist.

### Pass 2.6 — Product media + stock availability + notes + checkout ✅ VERIFIED
Live migrations on locked project `scpovyrqmsbiduanykod`:
- `20260906074952_product_media_and_pos_availability`
- `20260906075434_kds_modifier_and_notes_projection`
- `20260906080525_standardize_customer_modifier_rls_branch_helper`

Product media:
- Added `products.image_url` with bounded URL length.
- Image mutation uses `update_product_image_url` RPC guarded by `catalog.manage`.
- Catalog now contains a real media management panel with image/fallback preview.
- POS product tiles display image or deterministic fallback initial.
- This pass provides URL-backed product media; binary Storage upload is not falsely claimed and can be productized later if required.

Warehouse availability:
- New `get_pos_product_availability(branch, warehouse)` server projection guarded by `pos.view`.
- Direct-stock products use their inventory-item balance.
- BOM products use the limiting component quantity (`min(stock / component quantity)`).
- Missing inventory mapping, zero stock, insufficient components and unavailable warehouse return explicit states.
- POS disables unavailable products and displays real availability quantity/reason for the selected warehouse.
- Availability is proactive UX only; `send_order_to_kitchen` remains the authoritative concurrency/stock guard.
- Authenticated DEMO smoke returned all seven products with real warehouse-derived quantities.

Notes + KDS:
- Added server commands for order notes and line notes guarded by `pos.order.edit`.
- Order notes lock after first kitchen send; line notes lock after their first send, preserving exact KDS lineage.
- KDS detail projection now displays line notes and modifier snapshot summary.
- KDS ticket also shows the order-level note.
- Transactional authenticated DEMO smoke confirmed KDS received `كلاسيك برجر`, modifiers `جبنة إضافية، متوسط`, line note `بدون صوص على السطر`, and order note `بدون بصل على الطلب`; transaction rolled back.

Runtime review fix:
- Authenticated smoke exposed that newly introduced Customer/Modifier SELECT policies used `user_may_access_branch(branch,user)` directly while authenticated had no EXECUTE on that broader helper.
- We did **not** grant the broader helper to authenticated.
- Migration `20260906080525` standardized these policies on the established `current_user_may_access_branch(branch)` helper already used by the rest of POS.V2.
- This repaired Customer + Modifier direct reads under RLS while keeping the narrower session-scoped authorization model.

Checkout/payment productization:
- Added `CheckoutPanel` and replaced the old inline payment form in POS.
- Current contract remains Cash/Card only; Transfer/Credit were not invented.
- Supports repeated partial payments / split tender through the existing atomic `take_payment` contract.
- Cash UI separates applied payment amount from cash received and calculates customer change without over-posting the order payment.
- Quick full/half/quarter amount controls and clearer paid/remaining/history states added.
- Split-bill orders continue collecting through split controls to avoid duplicate collection paths.
- Payment numeric values are normalized with `Number()` before totals, preventing PostgreSQL numeric-string concatenation in frontend reductions.
- Transactional DEMO payment smoke: total 35.00 → cash 10.00 + card 25.00 → allocated 35.00 and order status `paid` ✅; rolled back.

Verification checkpoint after full POS checkout integration: `6cde7679b37641aea8d0963496eef8f4e02ffe25`
- CI #346 ✅
- Verify #750 ✅
- Release Guard #190 ✅

Advisor gate after DDL:
- Security: no new finding; only existing external Auth warning `Leaked Password Protection Disabled`.
- Performance: expected unused-index INFO only; no new warning/error was introduced.

### Pass 2.7 — Active Orders + Floor/Tables + Keyboard/Touch/Scanner polish ✅ VERIFIED
No DDL and no new mutation path in this pass.

Delivered:
- Active Orders converted into an operational panel with Orders/Tables modes while preserving branch-scoped reads and fine-grained POS permissions.
- Orders remain filterable by type/status and now show clearer status badges, guest count and totals.
- Floor/Tables workspace groups tables by floor/area and shows available/occupied state, capacity, active order and guest count.
- Clicking an occupied table opens its existing order; clicking an available table only preselects Dine-in/table when `pos.order.create` is allowed and a shift is open.
- Existing `TableOrderControls` remains the authoritative transfer/merge operational control; no parallel table mutation was created.
- Keyboard workflow: F2 search/scanner focus, F3 Orders/Tables switch, Escape clears search, Alt+Up/Down cycles visible active orders.
- Barcode/SKU exact-match Enter continues using `add_pos_order_item`; availability and edit permission guards are unchanged.
- Touch affordances and responsive table/order cards are isolated in `src/styles/pos-operations.css`.

Implementation checkpoint: `3cf469593141d4828294720b1ff6d98ae0992efd`
- CI #350 ✅
- Verify #757 ✅
- Release Guard #198 ✅
- Typecheck/Build ✅

### Pass 2.8 — Checkout interaction regression guard ✅ VERIFIED
Repository regression coverage was extended without weakening existing tests.

Delivered:
- Added `scripts/verify-batch10.mjs` and wired it into Verify + release candidate guards.
- Guards all five POS order-type UI contracts (`dine_in`, `take_away`, `drive_thru`, `delivery`, `quick`).
- Guards Permission-First POS markers for view/create/edit/payment/split/receipt/table management.
- Guards that Checkout cannot collect through the normal path when bill splits exist, preventing duplicate collection paths after Checkout replacement.
- Guards Split Bill mutations remain RPC-based and idempotent rather than direct protected writes.
- Guards receipt first-print/reprint remain server RPC/idempotency contracts.
- Guards Customer Display remains read-only through `get_customer_display_projection` and continues showing paid/remaining totals.
- Batch 10, Typecheck and Build all passed in GitHub Verify.

Regression checkpoint: `1a6d86e7ce4aa1b8ab47f1e02f076914215b03d9`
- CI #351 ✅
- Verify #760 ✅
- Release Guard #200 ✅
- Batch 10 ✅
- Typecheck/Build ✅

E2E boundary noted during this pass:
- Persistent DEMO branch, warehouses, products, tables and open shift were read and left intact.
- The available database execution tool does not permit impersonating an authenticated cashier via role/JWT claim switching.
- A postgres-owner smoke would bypass the exact Permission-First/RLS path being tested, so it is **not** accepted or recorded as the requested full cashier E2E.
- Full five-order-type **authenticated** cashier E2E therefore remains open and must be run with a real authenticated-session harness/browser; no DEMO data was deleted.

### Phase 2 UX layer ✅
- `src/styles/pos-phase2.css` remains the isolated POS functional UX layer.
- `src/styles/pos-operations.css` adds the operational orders/tables/touch layer without moving business authorization into layout.
- Search/F2/Clear + labeled order controls + active order cards + categories/filters + responsive fallbacks are independent from business authorization.
- Modifier UI is isolated in `src/modules/modifiers/modifiers.css` and does not move permission/business rules into layout.
- Checkout uses `src/styles/payments.css` and the existing payment service rather than duplicating payment business logic.

## Current parallel execution — NEXT GROUP
1. Full five-order-type authenticated cashier E2E on persistent DEMO, including Delivery + Drive Thru prerequisites — OPEN.
2. Product media storage/upload productization decision; current URL-backed media remains valid.
3. Runtime/table transfer-merge discoverability E2E in a real authenticated session.
4. Continue Security + Performance Advisor review after every DDL batch.

## 2026-09-06 — MODEL HANDOFF CHECKPOINT
Canonical continuation point for any second model:
- Repository: `Premieros/pos.v2`
- Branch: `development`
- Supabase project ref: `scpovyrqmsbiduanykod`
- Reference repo `Premieros/johna-s` remains READ ONLY.
- Latest branch HEAD observed before handoff: `ea0015adfe47b9319aab0f435e7bf96d9c726281` (`docs: record media availability notes and checkout pass`).
- Because another model may be working concurrently, the incoming model MUST re-read the current `development` HEAD before every write and must not overwrite or revert commits it did not author.
- Phase 1 Design Parity is closed.
- Phase 2 Passes 2.1–2.6 are implemented; Pass 2.6 is verified at code checkpoint `6cde7679b37641aea8d0963496eef8f4e02ffe25` with CI #346 / Verify #750 / Release Guard #190 green.
- Persistent DEMO data must remain; do not delete it.
- `main` must not be touched without explicit user approval.
- Next work begins from the `Current parallel execution — NEXT GROUP` section above.
- Update this log after each accepted pass and record exact commit + verification runs.

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
