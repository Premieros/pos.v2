import { LoginPage } from '../modules/auth/LoginPage'
import { useAuth } from '../modules/auth/useAuth'
import { useBranch } from '../modules/branches/useBranch'
import { CatalogPage } from '../modules/catalog/CatalogPage'
import { InventoryPage } from '../modules/inventory/InventoryPage'
import { KdsPage } from '../modules/kitchen/KdsPage'
import { usePermissions } from '../modules/permissions/usePermissions'
import { PosPage } from '../modules/pos/PosPage'
import { SuppliersPage } from '../modules/procurement/SuppliersPage'
import { ReturnPanel } from '../modules/returns/ReturnPanel'
import { InitialSetupPage } from '../modules/setup/InitialSetupPage'
import { ShiftsPage } from '../modules/shifts/ShiftsPage'

export function App() {
  const { user, loading: authLoading } = useAuth()
  const { currentBranch, loading: branchLoading, error: branchError } = useBranch()
  const { can, loading: permissionLoading } = usePermissions()

  if (authLoading) return <main className="shell" dir="rtl"><p>جارٍ تحميل الجلسة…</p></main>
  if (!user) return <LoginPage />
  if (branchLoading) return <main className="shell" dir="rtl"><p>جارٍ تحميل الفروع…</p></main>
  if (branchError) return <main className="shell" dir="rtl"><section className="card"><h1>تعذر تحميل الفروع</h1><p className="error-text">{branchError}</p></section></main>
  if (!currentBranch) return <InitialSetupPage />
  if (permissionLoading) return <main className="shell" dir="rtl"><p>جارٍ تحميل الصلاحيات…</p></main>

  const showPos = can('pos.view')
  const showReturns = can('pos.order.return') && can('pos.payment.refund')
  const showKitchen = can('kitchen.view') || can('kitchen.manage')
  const showCatalog = can('catalog.view') || can('catalog.manage')
  const showInventory = can('inventory.view')
  const showSuppliers = can('procurement.view') || can('procurement.suppliers.manage')
  const showShifts = can('shifts.view') || can('shifts.open') || can('shifts.close') || can('shifts.cash.move') || can('shifts.manage')

  return (
    <main className="app-shell" dir="rtl">
      <aside className="app-sidebar" aria-label="أقسام النظام">
        <div className="sidebar-brand">
          <span className="sidebar-brand-mark">P</span>
          <div>
            <strong>POS.V2</strong>
            <small>{currentBranch.name_ar}</small>
          </div>
        </div>

        <nav className="sidebar-nav">
          <a href="#overview">الرئيسية</a>
          {showPos ? <a href="#pos-section">شاشة البيع</a> : null}
          {showReturns ? <a href="#returns-section">المرتجعات</a> : null}
          {showKitchen ? <a href="#kds-section">المطبخ KDS</a> : null}
          {showCatalog ? <a href="#catalog-section">المنتجات والتصنيفات</a> : null}
          {showInventory ? <a href="#inventory-section">المخزون والمخازن</a> : null}
          {showSuppliers ? <a href="#suppliers-section">الموردون</a> : null}
          {showShifts ? <a href="#shifts-section">الورديات والدرج</a> : null}
        </nav>

        <div className="sidebar-footer">
          <span>الفرع الحالي</span>
          <strong>{currentBranch.code}</strong>
        </div>
      </aside>

      <div className="app-content">
        <header className="app-header" id="overview">
          <div>
            <p className="eyebrow">POS.V2</p>
            <h1>نظام التشغيل</h1>
            <p>الفرع الحالي: <strong>{currentBranch.name_ar}</strong></p>
          </div>
        </header>

        <section className="card status-card">
          <h2>الأساس التشغيلي جاهز</h2>
          <p>Auth وBranch Context وPermission Context تعمل بعقد موحد، والموديولات مستقلة بعقود صريحة.</p>
        </section>

        {showPos ? <section id="pos-section" className="app-section-anchor"><PosPage /></section> : null}
        {showReturns ? <section id="returns-section" className="app-section-anchor"><ReturnPanel /></section> : null}
        {showKitchen ? <section id="kds-section" className="app-section-anchor"><KdsPage /></section> : null}
        {showCatalog ? <section id="catalog-section" className="app-section-anchor"><CatalogPage /></section> : null}
        {showInventory ? <section id="inventory-section" className="app-section-anchor"><InventoryPage /></section> : null}
        {showSuppliers ? <section id="suppliers-section" className="app-section-anchor"><SuppliersPage /></section> : null}
        {showShifts ? <section id="shifts-section" className="app-section-anchor"><ShiftsPage /></section> : null}
      </div>
    </main>
  )
}
