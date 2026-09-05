import { LoginPage } from '../modules/auth/LoginPage'
import { useAuth } from '../modules/auth/useAuth'
import { useBranch } from '../modules/branches/useBranch'
import { usePermissions } from '../modules/permissions/usePermissions'
import { InitialSetupPage } from '../modules/setup/InitialSetupPage'

export function App() {
  const { user, loading: authLoading } = useAuth()
  const { currentBranch, loading: branchLoading, error: branchError } = useBranch()
  const { loading: permissionLoading } = usePermissions()

  if (authLoading) return <main className="shell" dir="rtl"><p>جارٍ تحميل الجلسة…</p></main>
  if (!user) return <LoginPage />
  if (branchLoading) return <main className="shell" dir="rtl"><p>جارٍ تحميل الفروع…</p></main>
  if (branchError) return <main className="shell" dir="rtl"><section className="card"><h1>تعذر تحميل الفروع</h1><p className="error-text">{branchError}</p></section></main>
  if (!currentBranch) return <InitialSetupPage />
  if (permissionLoading) return <main className="shell" dir="rtl"><p>جارٍ تحميل الصلاحيات…</p></main>

  return (
    <main className="shell" dir="rtl">
      <section className="card" aria-labelledby="app-title">
        <p className="eyebrow">POS.V2</p>
        <h1 id="app-title">الأساس التشغيلي جاهز</h1>
        <p>الفرع الحالي: <strong>{currentBranch.nameAr}</strong></p>
        <p>تم تثبيت Auth وBranch Context وPermission Context. الخطوة التالية هي إدارة المستخدمين والصلاحيات ثم الكتالوج.</p>
      </section>
    </main>
  )
}
