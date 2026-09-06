import { useEffect, useMemo, useState } from 'react'
import { useBranch } from '../branches/useBranch'
import { usePermissions } from '../permissions/usePermissions'
import { listAccounts, type Account } from './account.service'
import { createTreasuryAccount, createTreasuryMovement, listTreasuryAccounts, listTreasuryBalances, listTreasuryMovements, type TreasuryAccount, type TreasuryMovement } from './treasury.service'
import './accounting.css'

export function TreasuryPage() {
  const { currentBranchId } = useBranch()
  const { can } = usePermissions()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [treasuries, setTreasuries] = useState<TreasuryAccount[]>([])
  const [movements, setMovements] = useState<TreasuryMovement[]>([])
  const [balances, setBalances] = useState<Map<string, number>>(new Map())
  const [type, setType] = useState<'cash'|'bank'>('cash')
  const [direction, setDirection] = useState<'in'|'out'>('in')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canView = can('treasury.view') || can('treasury.accounts.manage') || can('treasury.movements.create')
  const canManage = can('treasury.accounts.manage')
  const canMove = can('treasury.movements.create')

  async function refresh() {
    if (!currentBranchId || !canView) return
    setLoading(true); setError(null)
    try {
      const [coa, ta, tm, tb] = await Promise.all([listAccounts(currentBranchId), listTreasuryAccounts(currentBranchId), listTreasuryMovements(currentBranchId), listTreasuryBalances(currentBranchId)])
      setAccounts(coa.filter((a) => a.is_active && a.is_postable))
      setTreasuries(ta)
      setMovements(tm)
      setBalances(new Map(tb.map((row) => [row.treasury_account_id, row.balance])))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر تحميل الخزينة') }
    finally { setLoading(false) }
  }

  useEffect(() => { void refresh() }, [currentBranchId, canView])
  const assetAccounts = useMemo(() => accounts.filter((a) => a.account_type === 'asset'), [accounts])
  const accountNames = useMemo(() => new Map(accounts.map((a) => [a.id, `${a.code} — ${a.name_ar}`])), [accounts])
  const treasuryNames = useMemo(() => new Map(treasuries.map((t) => [t.id, `${t.code} — ${t.name_ar}`])), [treasuries])

  if (!currentBranchId || !canView) return null
  const branchId = currentBranchId

  async function handleCreateAccount(form: HTMLFormElement) {
    const data = new FormData(form); setError(null)
    try {
      await createTreasuryAccount({ branchId, code: String(data.get('code') ?? ''), nameAr: String(data.get('nameAr') ?? ''), nameEn: String(data.get('nameEn') ?? ''), treasuryType: type, accountId: String(data.get('accountId') ?? ''), bankName: String(data.get('bankName') ?? ''), bankAccountReference: String(data.get('bankRef') ?? '') })
      form.reset(); setType('cash'); await refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر إنشاء حساب الخزينة') }
  }

  async function handleMovement(form: HTMLFormElement) {
    const data = new FormData(form); setError(null)
    try {
      await createTreasuryMovement({ branchId, treasuryAccountId: String(data.get('treasuryId') ?? ''), movementDate: String(data.get('movementDate') ?? ''), direction, amount: Number(data.get('amount') ?? 0), counterAccountId: String(data.get('counterAccountId') ?? ''), description: String(data.get('description') ?? ''), reference: String(data.get('reference') ?? ''), idempotencyKey: `treasury:${crypto.randomUUID()}` })
      form.reset(); setDirection('in'); await refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر تسجيل حركة الخزينة') }
  }

  return <section className="workspace-card accounting-workspace" aria-labelledby="treasury-title">
    <div className="workspace-heading"><div><p className="eyebrow">Treasury</p><h2 id="treasury-title">الخزينة والبنوك</h2><p>حسابات نقدية وبنكية محاسبية مستقلة عن درج الكاشير، والرصيد مشتق من الحركات فقط.</p></div><span>{treasuries.filter((t) => t.is_active).length} حساب نشط</span></div>
    {error ? <p className="error-text">{error}</p> : null}{loading ? <p>جارٍ تحميل الخزينة…</p> : null}

    {canManage ? <form className="treasury-form" onSubmit={(e) => { e.preventDefault(); void handleCreateAccount(e.currentTarget) }}>
      <input name="code" required placeholder="كود الخزينة"/><input name="nameAr" required placeholder="الاسم بالعربية"/><input name="nameEn" placeholder="الاسم بالإنجليزية"/>
      <select value={type} onChange={(e) => setType(e.target.value as 'cash'|'bank')}><option value="cash">نقدية</option><option value="bank">بنك</option></select>
      <select name="accountId" required defaultValue=""><option value="" disabled>حساب الأصل المرتبط</option>{assetAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name_ar}</option>)}</select>
      {type === 'bank' ? <><input name="bankName" placeholder="اسم البنك"/><input name="bankRef" placeholder="مرجع الحساب البنكي"/></> : null}
      <button type="submit">إضافة حساب خزينة</button>
    </form> : null}

    <div className="treasury-cards">{treasuries.map((t) => <article key={t.id} className="treasury-card"><div><strong>{t.code} — {t.name_ar}</strong><small>{t.treasury_type === 'cash' ? 'نقدية' : 'بنك'}</small></div><b>{(balances.get(t.id) ?? 0).toFixed(2)}</b><span>{t.is_active ? 'نشط' : 'موقوف'}</span></article>)}</div>

    {canMove ? <form className="treasury-form" onSubmit={(e) => { e.preventDefault(); void handleMovement(e.currentTarget) }}>
      <select name="treasuryId" required defaultValue=""><option value="" disabled>حساب الخزينة</option>{treasuries.filter((t) => t.is_active).map((t) => <option key={t.id} value={t.id}>{t.code} — {t.name_ar}</option>)}</select>
      <input name="movementDate" type="date" required defaultValue={new Date().toISOString().slice(0,10)}/>
      <select value={direction} onChange={(e) => setDirection(e.target.value as 'in'|'out')}><option value="in">إيداع / داخل</option><option value="out">صرف / خارج</option></select>
      <input name="amount" type="number" min="0.01" step="0.01" required placeholder="القيمة"/>
      <select name="counterAccountId" required defaultValue=""><option value="" disabled>الحساب المقابل</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name_ar}</option>)}</select>
      <input name="description" required placeholder="بيان الحركة"/><input name="reference" placeholder="مرجع اختياري"/><button type="submit">تسجيل الحركة</button>
    </form> : null}

    <div className="account-table-wrap"><table className="account-table treasury-table"><thead><tr><th>#</th><th>التاريخ</th><th>الخزينة</th><th>النوع</th><th>الحساب المقابل</th><th>القيمة</th><th>البيان</th><th>القيد</th></tr></thead><tbody>{movements.map((m) => <tr key={m.id}><td>{m.movement_number}</td><td>{m.movement_date}</td><td>{treasuryNames.get(m.treasury_account_id) ?? '—'}</td><td>{m.direction === 'in' ? 'داخل' : 'خارج'}</td><td>{accountNames.get(m.counter_account_id) ?? '—'}</td><td>{m.amount.toFixed(2)}</td><td>{m.description}</td><td>مرتبط</td></tr>)}</tbody></table></div>
  </section>
}
