import { LoginPage } from '../modules/auth/LoginPage'
import { useAuth } from '../modules/auth/useAuth'
import { useBranch } from '../modules/branches/useBranch'
import { CatalogPage } from '../modules/catalog/CatalogPage'
import { InventoryPage } from '../modules/inventory/InventoryPage'
import { usePermissions } from '../modules/permissions/usePermissions'
import { InitialSetupPage } from '../modules/setup/InitialSetupPage'

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

  return (
    <main className="app-shell" dir="rtl">
      <header className="app-header">
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

      {can('catalog.view') || can('catalog.manage') ? <CatalogPage /> : null}
      {can('inventory.view') ? <InventoryPage /> : null}
    </main>
  )
}
