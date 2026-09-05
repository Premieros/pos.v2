import { useState, type FormEvent } from 'react'
import { useBranch } from '../branches/useBranch'
import { bootstrapFirstSuperAdmin } from './setup.service'

export function InitialSetupPage() {
  const { refreshBranches } = useBranch()
  const [branchCode, setBranchCode] = useState('MAIN')
  const [branchNameAr, setBranchNameAr] = useState('الفرع الرئيسي')
  const [branchNameEn, setBranchNameEn] = useState('Main Branch')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
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

  return (
    <main className="shell" dir="rtl">
      <section className="card setup-card" aria-labelledby="setup-title">
        <p className="eyebrow">INITIAL SETUP</p>
        <h1 id="setup-title">تهيئة النظام لأول مرة</h1>
        <p>سيتم إنشاء أول فرع وربط حسابك بدور Super Admin المحمي. هذه العملية تعمل مرة واحدة فقط.</p>
        <form className="form-stack" onSubmit={onSubmit}>
          <label>
            كود الفرع
            <input value={branchCode} onChange={(event) => setBranchCode(event.target.value)} required />
          </label>
          <label>
            اسم الفرع بالعربية
            <input value={branchNameAr} onChange={(event) => setBranchNameAr(event.target.value)} required />
          </label>
          <label>
            اسم الفرع بالإنجليزية
            <input value={branchNameEn} onChange={(event) => setBranchNameEn(event.target.value)} />
          </label>
          {error ? <p className="error-text" role="alert">{error}</p> : null}
          <button type="submit" disabled={submitting}>{submitting ? 'جارٍ التهيئة…' : 'إنشاء النظام'}</button>
        </form>
      </section>
    </main>
  )
}
