import { ChartOfAccountsPage } from '../modules/accounting/ChartOfAccountsPage'
import { ExpensesPage } from '../modules/accounting/ExpensesPage'
import { JournalPage } from '../modules/accounting/JournalPage'
import { PostingCenterPage } from '../modules/accounting/PostingCenterPage'
import { StatementsPage } from '../modules/accounting/StatementsPage'
import { TreasuryPage } from '../modules/accounting/TreasuryPage'
import { AdminPage } from '../modules/admin/AdminPage'
import { ApprovalCenterPage } from '../modules/approvals/ApprovalCenterPage'
import { LoginPage } from '../modules/auth/LoginPage'
import { useAuth } from '../modules/auth/useAuth'
import { useBranch } from '../modules/branches/useBranch'
import { CatalogPage } from '../modules/catalog/CatalogPage'
import { InventoryPage } from '../modules/inventory/InventoryPage'
import { StockCountPage } from '../modules/inventory/StockCountPage'
import { WastePage } from '../modules/inventory/WastePage'
import { KdsPage } from '../modules/kitchen/KdsPage'
import { usePermissions } from '../modules/permissions/usePermissions'
import { PosPage } from '../modules/pos/PosPage'
import { PrintingCenterPage } from '../modules/printing/PrintingCenterPage'
import { PurchasesPage } from '../modules/procurement/PurchasesPage'
import { SuppliersPage } from '../modules/procurement/SuppliersPage'
import { ReportsPage } from '../modules/reports/ReportsPage'
import { ReturnPanel } from '../modules/returns/ReturnPanel'
import { GuidedSetupBanner } from '../modules/setup/GuidedSetupBanner'
import { InitialSetupPage } from '../modules/setup/InitialSetupPage'
import { ShiftsPage } from '../modules/shifts/ShiftsPage'
import { useShellPreferences } from '../modules/shell/useShellPreferences'

type NavItem = { href: string; icon: string; ar: string; en: string; visible: boolean }

export function App() {
  const { user, loading: authLoading } = useAuth()
  const { branches, currentBranch, setCurrentBranchId, loading: branchLoading, error: branchError } = useBranch()
  const { can, loading: permissionLoading } = usePermissions()
  const { locale, dir, collapsed, mobileOpen, setLocale, setCollapsed, setMobileOpen } = useShellPreferences()
  const isArabic = locale === 'ar'
  const t = (ar: string, en: string) => isArabic ? ar : en

  if (authLoading) return <main className="shell" dir={dir}><p>{t('جارٍ تحميل الجلسة…', 'Loading session…')}</p></main>
  if (!user) return <LoginPage />
  if (branchLoading) return <main className="shell" dir={dir}><p>{t('جارٍ تحميل الفروع…', 'Loading branches…')}</p></main>
  if (branchError) return <main className="shell" dir={dir}><section className="card"><h1>{t('تعذر تحميل الفروع', 'Could not load branches')}</h1><p className="error-text">{branchError}</p></section></main>
  if (!currentBranch) return <InitialSetupPage />
  if (permissionLoading) return <main className="shell" dir={dir}><p>{t('جارٍ تحميل الصلاحيات…', 'Loading permissions…')}</p></main>

  const showPos = can('pos.view')
  const showReturns = can('pos.order.return') && can('pos.payment.refund')
  const showKitchen = can('kitchen.view') || can('kitchen.manage')
  const showCatalog = can('catalog.view') || can('catalog.manage')
  const showInventory = can('inventory.view')
  const showWaste = can('inventory.waste')
  const showCounts = can('inventory.count')
  const showApprovals = can('approvals.view') || can('approvals.review')
  const showSuppliers = can('procurement.view') || can('procurement.suppliers.manage')
  const showPurchases = can('procurement.purchases.view') || can('procurement.purchases.create') || can('procurement.purchases.edit') || can('procurement.purchases.submit') || can('procurement.purchases.cancel') || can('procurement.purchases.receive')
  const showAccounting = can('accounting.coa.view') || can('accounting.coa.manage')
  const showJournals = can('accounting.journals.view') || can('accounting.journals.create') || can('accounting.journals.edit') || can('accounting.journals.post') || can('accounting.journals.reverse')
  const showExpenses = can('accounting.expenses.view') || can('accounting.expenses.create') || can('accounting.expenses.edit') || can('accounting.expenses.post')
  const showTreasury = can('treasury.view') || can('treasury.accounts.manage') || can('treasury.movements.create')
  const showPosting = can('accounting.posting.view') || can('accounting.posting.manage') || can('accounting.posting.retry')
  const showStatements = can('accounting.statements.view')
  const showReports = can('reports.view')
  const showShifts = can('shifts.view') || can('shifts.open') || can('shifts.close') || can('shifts.cash.move') || can('shifts.manage')
  const showPrinting = can('pos.receipt.print') || can('pos.receipt.reprint') || showKitchen || can('shifts.view') || can('shifts.manage') || showReports
  const showAdmin = can('settings.manage') || can('branches.view') || can('branches.manage') || can('branches.update') || can('users.view') || can('users.manage') || can('users.permissions.manage') || can('roles.view') || can('roles.manage') || can('roles.assign') || can('inventory.setup')

  const navItems: NavItem[] = [
    { href: '#overview', icon: '⌂', ar: 'الرئيسية', en: 'Overview', visible: true },
    { href: '#pos-section', icon: '▣', ar: 'شاشة البيع', en: 'POS', visible: showPos },
    { href: '#returns-section', icon: '↩', ar: 'المرتجعات', en: 'Returns', visible: showReturns },
    { href: '#kds-section', icon: '⌁', ar: 'المطبخ KDS', en: 'Kitchen KDS', visible: showKitchen },
    { href: '#catalog-section', icon: '◇', ar: 'المنتجات والتصنيفات', en: 'Catalog', visible: showCatalog },
    { href: '#inventory-section', icon: '▦', ar: 'المخزون والمخازن', en: 'Inventory', visible: showInventory },
    { href: '#waste-section', icon: '△', ar: 'مركز الهالك', en: 'Waste', visible: showWaste },
    { href: '#count-section', icon: '✓', ar: 'جلسات الجرد', en: 'Stock Counts', visible: showCounts },
    { href: '#approvals-section', icon: '◎', ar: 'مركز الموافقات', en: 'Approvals', visible: showApprovals },
    { href: '#suppliers-section', icon: '♢', ar: 'الموردون', en: 'Suppliers', visible: showSuppliers },
    { href: '#purchases-section', icon: '＋', ar: 'أوامر الشراء', en: 'Purchases', visible: showPurchases },
    { href: '#reports-section', icon: '≡', ar: 'التقارير', en: 'Reports', visible: showReports },
    { href: '#printing-section', icon: '▤', ar: 'مركز الطباعة', en: 'Printing', visible: showPrinting },
    { href: '#admin-section', icon: '⚙', ar: 'الإدارة والإعدادات', en: 'Administration', visible: showAdmin },
    { href: '#accounting-section', icon: '∑', ar: 'دليل الحسابات', en: 'Chart of Accounts', visible: showAccounting },
    { href: '#journals-section', icon: '≣', ar: 'القيود اليومية', en: 'Journals', visible: showJournals },
    { href: '#expenses-section', icon: '−', ar: 'المصروفات', en: 'Expenses', visible: showExpenses },
    { href: '#treasury-section', icon: '□', ar: 'الخزينة والبنوك', en: 'Treasury', visible: showTreasury },
    { href: '#posting-section', icon: '⇄', ar: 'ربط المحاسبة', en: 'Posting Center', visible: showPosting },
    { href: '#statements-section', icon: '▥', ar: 'القوائم المالية', en: 'Statements', visible: showStatements },
    { href: '#shifts-section', icon: '◷', ar: 'الورديات والدرج', en: 'Shifts & Drawer', visible: showShifts },
  ]

  const branchName = isArabic ? currentBranch.name_ar : (currentBranch.name_en || currentBranch.name_ar)

  return (
    <main className="app-shell" dir={dir} data-locale={locale} data-sidebar-collapsed={collapsed ? 'true' : 'false'} data-mobile-nav={mobileOpen ? 'open' : 'closed'}>
      <button type="button" className="mobile-nav-button" aria-label={t('فتح القائمة', 'Open navigation')} aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)}>☰</button>
      <button type="button" className="sidebar-overlay" aria-label={t('إغلاق القائمة', 'Close navigation')} onClick={() => setMobileOpen(false)} />

      <aside className="app-sidebar" aria-label={t('أقسام النظام', 'System sections')}>
        <div className="sidebar-brand">
          <span className="sidebar-brand-mark">P</span>
          <div className="sidebar-brand-copy"><strong>POS.V2</strong><small>{branchName}</small></div>
          <button type="button" className="sidebar-mobile-close" aria-label={t('إغلاق القائمة', 'Close navigation')} onClick={() => setMobileOpen(false)}>×</button>
        </div>

        <nav className="sidebar-nav">
          {navItems.filter((item) => item.visible).map((item) => (
            <a key={item.href} href={item.href} title={isArabic ? item.ar : item.en} onClick={() => setMobileOpen(false)}>
              <span className="sidebar-nav-icon" aria-hidden="true">{item.icon}</span>
              <span className="sidebar-nav-label">{isArabic ? item.ar : item.en}</span>
            </a>
          ))}
        </nav>

        <div className="sidebar-controls">
          <div className="locale-switch" role="group" aria-label={t('لغة واتجاه الواجهة', 'Interface language and direction')}>
            <button type="button" className={locale === 'ar' ? 'active' : ''} onClick={() => setLocale('ar')}>AR</button>
            <button type="button" className={locale === 'en' ? 'active' : ''} onClick={() => setLocale('en')}>EN</button>
          </div>
          <button type="button" className="sidebar-collapse-button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? t('توسيع القائمة', 'Expand sidebar') : t('طي القائمة', 'Collapse sidebar')}>
            <span aria-hidden="true">{collapsed ? '»' : '«'}</span><span className="sidebar-nav-label">{collapsed ? t('توسيع', 'Expand') : t('طي القائمة', 'Collapse')}</span>
          </button>
        </div>

        <div className="sidebar-footer"><span>{t('الفرع الحالي', 'Current branch')}</span><strong>{currentBranch.code}</strong></div>
      </aside>

      <div className="app-content">
        <header className="app-header" id="overview">
          <div><p className="eyebrow">POS.V2</p><h1>{t('نظام التشغيل', 'Operations')}</h1><p>{t('الفرع الحالي:', 'Current branch:')} <strong>{branchName}</strong></p></div>
          <div className="header-controls">
            {branches.length > 1 ? <label className="branch-switcher">{t('تغيير الفرع', 'Switch branch')}<select value={currentBranch.id} onChange={(event) => setCurrentBranchId(event.target.value)}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{isArabic ? branch.name_ar : (branch.name_en || branch.name_ar)} — {branch.code}</option>)}</select></label> : null}
            <div className="header-locale-switch"><button type="button" className={locale === 'ar' ? 'active' : ''} onClick={() => setLocale('ar')}>AR</button><button type="button" className={locale === 'en' ? 'active' : ''} onClick={() => setLocale('en')}>EN</button></div>
          </div>
        </header>
        <section className="card status-card"><h2>{t('الأساس التشغيلي جاهز', 'Operational foundation ready')}</h2><p>{t('الموديولات مستقلة بعقود صريحة وتُعرض حسب الصلاحيات الفعلية.', 'Modules remain contract-isolated and are displayed by effective permissions.')}</p></section>
        {showPos ? <GuidedSetupBanner /> : null}
        {showPos ? <section id="pos-section" className="app-section-anchor"><PosPage /></section> : null}
        {showReturns ? <section id="returns-section" className="app-section-anchor"><ReturnPanel /></section> : null}
        {showKitchen ? <section id="kds-section" className="app-section-anchor"><KdsPage /></section> : null}
        {showCatalog ? <section id="catalog-section" className="app-section-anchor"><CatalogPage /></section> : null}
        {showInventory ? <section id="inventory-section" className="app-section-anchor"><InventoryPage /></section> : null}
        {showWaste ? <section id="waste-section" className="app-section-anchor"><WastePage /></section> : null}
        {showCounts ? <section id="count-section" className="app-section-anchor"><StockCountPage /></section> : null}
        {showApprovals ? <section id="approvals-section" className="app-section-anchor"><ApprovalCenterPage /></section> : null}
        {showSuppliers ? <section id="suppliers-section" className="app-section-anchor"><SuppliersPage /></section> : null}
        {showPurchases ? <section id="purchases-section" className="app-section-anchor"><PurchasesPage /></section> : null}
        {showReports ? <section id="reports-section" className="app-section-anchor"><ReportsPage /></section> : null}
        {showPrinting ? <section id="printing-section" className="app-section-anchor"><PrintingCenterPage /></section> : null}
        {showAdmin ? <section id="admin-section" className="app-section-anchor"><AdminPage /></section> : null}
        {showAccounting ? <section id="accounting-section" className="app-section-anchor"><ChartOfAccountsPage /></section> : null}
        {showJournals ? <section id="journals-section" className="app-section-anchor"><JournalPage /></section> : null}
        {showExpenses ? <section id="expenses-section" className="app-section-anchor"><ExpensesPage /></section> : null}
        {showTreasury ? <section id="treasury-section" className="app-section-anchor"><TreasuryPage /></section> : null}
        {showPosting ? <section id="posting-section" className="app-section-anchor"><PostingCenterPage /></section> : null}
        {showStatements ? <section id="statements-section" className="app-section-anchor"><StatementsPage /></section> : null}
        {showShifts ? <section id="shifts-section" className="app-section-anchor"><ShiftsPage /></section> : null}
      </div>
    </main>
  )
}
