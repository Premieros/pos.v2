import { useEffect, useState } from 'react'
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
  const [activeHref, setActiveHref] = useState(() => window.location.hash || '#overview')
  const isArabic = locale === 'ar'
  const t = (ar: string, en: string) => isArabic ? ar : en

  useEffect(() => {
    const syncLocation = () => setActiveHref(window.location.hash || '#overview')
    window.addEventListener('hashchange', syncLocation)
    window.addEventListener('popstate', syncLocation)
    return () => {
      window.removeEventListener('hashchange', syncLocation)
      window.removeEventListener('popstate', syncLocation)
    }
  }, [])

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

  const visibleNavItems = navItems.filter((item) => item.visible)
  const activeItem = visibleNavItems.find((item) => item.href === activeHref) ?? visibleNavItems[0]
  const currentHref = activeItem?.href ?? '#overview'
  const branchName = isArabic ? currentBranch.name_ar : (currentBranch.name_en || currentBranch.name_ar)

  const navigate = (href: string) => {
    if (window.location.hash !== href) window.history.pushState(null, '', href)
    setActiveHref(href)
    setMobileOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const renderWorkspace = () => {
    switch (currentHref) {
      case '#pos-section': return <><GuidedSetupBanner /><PosPage /></>
      case '#returns-section': return <ReturnPanel />
      case '#kds-section': return <KdsPage />
      case '#catalog-section': return <CatalogPage />
      case '#inventory-section': return <InventoryPage />
      case '#waste-section': return <WastePage />
      case '#count-section': return <StockCountPage />
      case '#approvals-section': return <ApprovalCenterPage />
      case '#suppliers-section': return <SuppliersPage />
      case '#purchases-section': return <PurchasesPage />
      case '#reports-section': return <ReportsPage />
      case '#printing-section': return <PrintingCenterPage />
      case '#admin-section': return <AdminPage />
      case '#accounting-section': return <ChartOfAccountsPage />
      case '#journals-section': return <JournalPage />
      case '#expenses-section': return <ExpensesPage />
      case '#treasury-section': return <TreasuryPage />
      case '#posting-section': return <PostingCenterPage />
      case '#statements-section': return <StatementsPage />
      case '#shifts-section': return <ShiftsPage />
      default:
        return <section className="card status-card"><h2>{t('النظام جاهز للعمل', 'System ready')}</h2><p>{t('اختر أي قسم من القائمة الجانبية لفتحه في مساحة عمل مستقلة.', 'Choose a module from the sidebar to open it in its own workspace.')}</p></section>
    }
  }

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
          {visibleNavItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={currentHref === item.href ? 'active' : undefined}
              aria-current={currentHref === item.href ? 'page' : undefined}
              title={isArabic ? item.ar : item.en}
              onClick={(event) => { event.preventDefault(); navigate(item.href) }}
            >
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
        <header className="app-header">
          <div><p className="eyebrow">POS.V2</p><h1>{isArabic ? activeItem.ar : activeItem.en}</h1><p>{t('الفرع الحالي:', 'Current branch:')} <strong>{branchName}</strong></p></div>
          <div className="header-controls">
            {branches.length > 1 ? <label className="branch-switcher">{t('تغيير الفرع', 'Switch branch')}<select value={currentBranch.id} onChange={(event) => setCurrentBranchId(event.target.value)}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{isArabic ? branch.name_ar : (branch.name_en || branch.name_ar)} — {branch.code}</option>)}</select></label> : null}
            <div className="header-locale-switch"><button type="button" className={locale === 'ar' ? 'active' : ''} onClick={() => setLocale('ar')}>AR</button><button type="button" className={locale === 'en' ? 'active' : ''} onClick={() => setLocale('en')}>EN</button></div>
          </div>
        </header>

        <section key={currentHref} className="app-view" aria-label={isArabic ? activeItem.ar : activeItem.en}>
          {renderWorkspace()}
        </section>
      </div>
    </main>
  )
}
