import { useState, type FormEvent } from 'react'
import { signInWithPassword } from './auth.service'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await signInWithPassword(email.trim(), password)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تسجيل الدخول')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="shell" dir="rtl">
      <section className="card auth-card" aria-labelledby="login-title">
        <p className="eyebrow">POS.V2</p>
        <h1 id="login-title">تسجيل الدخول</h1>
        <form className="form-stack" onSubmit={onSubmit}>
          <label>
            البريد الإلكتروني
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
          </label>
          <label>
            كلمة المرور
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />
          </label>
          {error ? <p className="error-text" role="alert">{error}</p> : null}
          <button type="submit" disabled={submitting}>{submitting ? 'جارٍ الدخول…' : 'دخول'}</button>
        </form>
      </section>
    </main>
  )
}
