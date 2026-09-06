# POS.V2 — Next Model Continuation Prompt

استخدم النص التالي كما هو مع النموذج الآخر:

---

أنت ستكمل تطوير مشروع POS/ERP باسم **POS.V2** من آخر نقطة موثقة، بدون إعادة بناء ما أُغلق وبدون لمس المشروع المرجعي.

## الهوية الإلزامية
- GitHub repository: `Premieros/pos.v2`
- Working branch: `development`
- `main`: ممنوع التعديل/الدمج إليه بدون موافقة صريحة من المستخدم.
- Supabase production project ref: `scpovyrqmsbiduanykod`
- Reference repo: `Premieros/johna-s` — **READ ONLY فقط**. ممنوع أي commit/write/workflow/Supabase/secrets/migrations عليه، وممنوع نسخ source code/CSS/SQL منه. نأخذ منه المميزات وتجربة الاستخدام فقط.

## ابدأ دائمًا بهذه الخطوات
1. اقرأ `docs/FEATURE_PARITY_PLAN.md`.
2. اقرأ `docs/FEATURE_PARITY_LOG.md` بالكامل؛ هو سجل التنفيذ الحالي وSource of Truth لهذه المرحلة.
3. اقرأ `docs/DEVELOPMENT_RULES.md`, `docs/SYSTEM_CONTRACT.md`, `docs/CURRENT_WORK_PLAN.md`, `docs/DATABASE_IDENTITY_LOCK.md` عند الحاجة للعقود الأساسية.
4. اجلب HEAD الحالي لفرع `development` قبل أي تعديل. آخر HEAD شوهد وقت التسليم كان `ea0015adfe47b9319aab0f435e7bf96d9c726281` ثم تم تحديث السجل/التسليم بعده، لذلك لا تفترض أن هذا هو HEAD الحالي.
5. لأن نموذجًا آخر قد يعمل بالتوازي: قبل كل write أعد قراءة الملف/HEAD الحالي، ولا تعكس أو تستبدل commits لم تراجعها.
6. قبل أي DDL تحقق أن Supabase ref يساوي **بالضبط** `scpovyrqmsbiduanykod`. إذا اختلف، توقف فورًا.
7. بعد أي DDL شغّل Security Advisor + Performance Advisor وسجل النتائج.
8. لا تحذف بيانات `DEMO`; هي بيانات اختبار دائمة بطلب المستخدم.

## الحالة المنجزة
### Phase 1 — Design Parity
مغلقة ومتحققة: App Shell / navigation / POS / KDS / reports / catalog / inventory / procurement / shifts / admin / printing / responsive / RTL.

### Phase 2 — POS Functional Completion
Passes 2.1–2.6 منفذة. أهم المنجز:
- Product search عربي/إنجليزي + SKU + Barcode + F2.
- Categories + active-order filters.
- Dine-in / Take Away / Drive Thru / Delivery / Quick order start UX.
- Customer + address + Delivery + Drive-Thru context، مع server-side kitchen prerequisites.
- Modifiers كاملة: groups/options/min/max/required/price delta/inventory mapping/product assignment/order-line snapshots/KDS delta/return lineage/lock after kitchen.
- Modifier editor داخل POS + Modifier management داخل Catalog.
- Persistent DEMO modifiers واختبار Transaction/Rollback ناجح.
- Product image URL contract + catalog media management + POS image/fallback.
- Warehouse-aware POS availability API: direct inventory أو limiting BOM component، مع تعطيل المنتج غير المتاح في POS، مع بقاء `send_order_to_kitchen` هو الحارس النهائي للمخزون.
- Order notes + line notes مع قفل بعد kitchen lineage، وعرضها في KDS مع modifier summary.
- CheckoutPanel حقيقي بدل payment form القديم، Cash/Card فقط حسب العقد الحالي، partial/split tender عبر نفس atomic payment contract، cash received/change بدون over-posting.
- Authenticated/RLS runtime regression الذي ظهر في Customer/Modifier policies تم إصلاحه باستخدام `current_user_may_access_branch(branch)` بدل توسيع EXECUTE على helper أوسع.

آخر checkpoint وظيفي موثق ومتحقق:
`6cde7679b37641aea8d0963496eef8f4e02ffe25`
- CI #346 ✅
- Verify #750 ✅
- Release Guard #190 ✅

Security Advisor: لا finding جديد؛ فقط التحذير الخارجي المعروف `Leaked Password Protection Disabled`.
Performance Advisor: unused-index INFO المتوقع فقط.

## المهمة التالية — اعمل بالتوازي مع مراجعة ما سبق
ابدأ من هذه المجموعة ولا تعيد فتح Passes 2.1–2.6 إلا إذا ظهر Regression مثبت:

1. **Active Orders operational drawer/panel**
   - تحويل قائمة الطلبات الحالية إلى workspace تشغيلي أوضح.
   - Counters/filters/search إذا كانت العقود الحالية تكفي.
   - فتح/استئناف الطلب بسرعة بدون كسر permissions.

2. **Floor / Tables workspace**
   - occupancy واضح.
   - guest count واضح.
   - table selection/transfer/merge discoverability أفضل.
   - لا تنقل business logic إلى layout.

3. **POS keyboard/touch/scanner polish**
   - shortcut workflow للكاشير.
   - touch targets.
   - barcode scanner behavior.
   - لا تضف shortcut يتجاوز permission أو server contract.

4. **Five-order-type E2E on DEMO**
   - Dine-in.
   - Take Away.
   - Drive Thru مع المرجع الإلزامي.
   - Delivery مع customer + address.
   - Quick Order.
   - لكل دورة: add → modifiers/notes → kitchen → KDS → payment → receipt/close حسب العقد.
   - اختبر denial paths أيضًا.

5. **Regression after Checkout replacement**
   - split bill.
   - receipt/reprint.
   - customer display.
   - returns/refunds إن تأثرت بمسار الدفع الجديد.

6. **Product media storage decision**
   - URL-backed media الحالي صحيح ومقبول.
   - لا تضف Storage upload إلا إذا قدرت تبنيه بعقد آمن واضح وبدون تخمين.

## قواعد التنفيذ
- Permission-first دائمًا؛ لا role-name checks في feature code.
- `allowed = super_admin OR (branch access AND effective permission)`.
- Super Admin hidden + immutable + global.
- RLS mandatory.
- critical mutations server-side atomic/idempotent.
- لا direct frontend writes لمجرد سهولة التنفيذ عندما العقد يتطلب RPC.
- لا weakening للاختبارات أو RLS.
- guided prerequisites بدل raw DB errors.
- لا unrelated refactor داخل bug fix.
- لا claim completion بدون actual verification.
- بعد كل pass ناجح: حدث `docs/FEATURE_PARITY_LOG.md` وسجل commit SHA + CI/Verify/Release Guard.

## طريقة العمل المطلوبة من المستخدم
- نفّذ مباشرة ولا تكثر الأسئلة.
- اعمل مسارات متوازية عند الإمكان لكن تجنب الكتابة المتعارضة على نفس الملف.
- راجع ما سبق باستمرار لاكتشاف regressions مبكرًا.
- لا تتوقف عند status فقط؛ أكمل حتى تحقق تقدم فعلي.
- إذا ظهر Regression، أصلحه في جذره قبل فتح ميزة جديدة.

ابدأ الآن بقراءة السجل وHEAD الحالي ثم نفّذ مجموعة Active Orders + Floor/Tables + Keyboard/Touch بالتوازي، وشغّل التحقق، وحدث السجل باستمرار.

---
