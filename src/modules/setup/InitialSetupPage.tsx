import { useEffect, useState, type FormEvent } from 'react'
import { StatePanel } from '../../components/StatePanel'
import { useBranch } from '../branches/useBranch'
import { bootstrapFirstSuperAdmin, getInitialSetupState, type InitialSetupState } from './setup.service'

export function InitialSetupPage() {
  const { refreshBranches } = useBranch()
  const [state, setState] = useState<InitialSetupState | null>(null)
  const [branchCode, setBranchCode] = useState('MAIN')
  const [branchNameAr, setBranchNameAr] = useState('الفرع الرئيسي')
  const [branchNameEn, setBranchNameEn] = useState('Main Branch')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void getInitialSetupState()
      .then(setState)
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'تعذر تحديد حالة التهيئة'))
  }, [])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!state?.bootstrap_available) return
    setSubmitting(true)
    setError(null)
    try {
      await bootstrapFirstSuperAdmin({ branchCode, branchNameAr, branchNameEn })
      await refreshBranches()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تهيئة النظام')
    } finally {
      setSubmitting(false)
    }
  }

  if (!state && !error) return <main className="shell" dir="rtl"><StatePanel kind="loading" title="جارٍ تحديد خطوات الإعداد المطلوبة…" /></main>
  if (!state && error) return <main className="shell" dir="rtl"><StatePanel kind="error" title="تعذر تحديد حالة التهيئة" description={error} /></main>

  if (state && !state.bootstrap_available) {
    return (
      <main className="shell" dir="rtl">
        <section className="card setup-card" aria-labelledby="setup-title">
          <p className="eyebrow">ACCESS REQUIRED</p>
          <h1 id="setup-title">لا يوجد فرع متاح لهذا الحساب</h1>
          <StatePanel kind="unauthorized" title="الحساب لا يملك فرعًا متاحًا" description="النظام مهيأ بالفعل، لذلك لن يتم تشغيل Bootstrap مرة أخرى. يجب أن يمنحك مسؤول مخول وصولًا إلى فرع من الإدارة والإعدادات." compact />
          <p className="muted-text">الفروع الموجودة بالنظام: {state.branch_count}. لا يتم عرض أسماء أو بيانات الفروع غير المصرح بها.</p>
          <button type="button" onClick={() => void refreshBranches()}>إعادة التحقق من الوصول</button>
          {error ? <StatePanel kind="error" title="تعذر إعادة التحقق" description={error} compact /> : null}
        </section>
      </main>
    )
  }

  return (
    <main className="shell" dir="rtl">
      <section className="card setup-card" aria-labelledby="setup-title">
        <p className="eyebrow">INITIAL SETUP</p>
        <h1 id="setup-title">تهيئة النظام لأول مرة</h1>
        <p>تم التحقق أن النظام ما زال Fresh. سيتم إنشاء أول فرع وربط حسابك بدور Super Admin المحمي، وهذه العملية تعمل مرة واحدة فقط.</p>
        <form className="form-stack" onSubmit={onSubmit}>
          <label>كود الفرع<input value={branchCode} onChange={(event) => setBranchCode(event.target.value)} required /></label>
          <label>اسم الفرع بالعربية<input value={branchNameAr} onChange={(event) => setBranchNameAr(event.target.value)} required /></label>
          <label>اسم الفرع بالإنجليزية<input value={branchNameEn} onChange={(event) => setBranchNameEn(event.target.value)} /></label>
          {error ? <StatePanel kind="error" title="تعذر تهيئة النظام" description={error} compact /> : null}
          <button type="submit" disabled={submitting}>{submitting ? 'جارٍ التهيئة…' : 'إنشاء النظام'}</button>
        </form>
      </section>
    </main>
  )
}
