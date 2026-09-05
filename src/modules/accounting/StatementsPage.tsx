import { useEffect, useMemo, useState } from 'react'
import { useBranch } from '../branches/useBranch'
import { usePermissions } from '../permissions/usePermissions'
import { listAccounts, type Account } from './account.service'
import { getBalanceSheet, getGeneralLedger, getIncomeStatement, getTrialBalance, type BalanceSheetRow, type IncomeStatementRow, type LedgerRow, type TrialBalanceRow } from './statements.service'
import './accounting.css'

type StatementTab = 'trial' | 'ledger' | 'income' | 'balance'

function monthStart() {
  const date = new Date()
  date.setDate(1)
  return date.toISOString().slice(0, 10)
}

function today() { return new Date().toISOString().slice(0, 10) }

export function StatementsPage() {
  const { currentBranchId } = useBranch()
  const { can } = usePermissions()
  const [tab, setTab] = useState<StatementTab>('trial')
  const [fromDate, setFromDate] = useState(monthStart())
  const [toDate, setToDate] = useState(today())
  const [accountId, setAccountId] = useState('')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [trial, setTrial] = useState<TrialBalanceRow[]>([])
  const [ledger, setLedger] = useState<LedgerRow[]>([])
  const [income, setIncome] = useState<IncomeStatementRow[]>([])
  const [balance, setBalance] = useState<BalanceSheetRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canView = can('accounting.statements.view')

  useEffect(() => {
    if (!currentBranchId || !canView) return
    void listAccounts(currentBranchId).then((rows) => {
      const postable = rows.filter((row) => row.is_postable)
      setAccounts(postable)
      if (!accountId && postable.length) setAccountId(postable[0].id)
    }).catch((cause) => setError(cause instanceof Error ? cause.message : 'تعذر تحميل الحسابات'))
  }, [currentBranchId, canView])

  async function runStatement() {
    if (!currentBranchId) return
    setLoading(true)
    setError(null)
    try {
      if (tab === 'trial') setTrial(await getTrialBalance(currentBranchId, fromDate, toDate))
      if (tab === 'ledger') {
        if (!accountId) throw new Error('اختر حسابًا لدفتر الأستاذ')
        setLedger(await getGeneralLedger(currentBranchId, accountId, fromDate, toDate))
      }
      if (tab === 'income') setIncome(await getIncomeStatement(currentBranchId, fromDate, toDate))
      if (tab === 'balance') setBalance(await getBalanceSheet(currentBranchId, toDate))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل القائمة المالية')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (currentBranchId && canView) void runStatement() }, [currentBranchId, canView, tab])

  const trialTotals = useMemo(() => trial.reduce((sum, row) => ({ debit: sum.debit + row.total_debit, credit: sum.credit + row.total_credit }), { debit: 0, credit: 0 }), [trial])
  const incomeTotals = useMemo(() => income.reduce((sum, row) => row.account_type === 'revenue' ? { ...sum, revenue: sum.revenue + row.amount } : { ...sum, expense: sum.expense + row.amount }, { revenue: 0, expense: 0 }), [income])
  const balanceTotals = useMemo(() => balance.reduce((sum, row) => {
    if (row.account_type === 'asset') return { ...sum, asset: sum.asset + row.amount }
    if (row.account_type === 'liability') return { ...sum, liability: sum.liability + row.amount }
    return { ...sum, equity: sum.equity + row.amount }
  }, { asset: 0, liability: 0, equity: 0 }), [balance])

  if (!currentBranchId || !canView) return null

  return (
    <section className="workspace-card accounting-workspace" aria-labelledby="statements-title">
      <div className="workspace-heading">
        <div><p className="eyebrow">Accounting</p><h2 id="statements-title">القوائم المالية</h2><p>تقارير محاسبية Read-only مبنية حصريًا من القيود المرحلة.</p></div>
      </div>

      <div className="statement-tabs" role="tablist">
        <button type="button" className={tab === 'trial' ? 'active' : ''} onClick={() => setTab('trial')}>ميزان المراجعة</button>
        <button type="button" className={tab === 'ledger' ? 'active' : ''} onClick={() => setTab('ledger')}>دفتر الأستاذ</button>
        <button type="button" className={tab === 'income' ? 'active' : ''} onClick={() => setTab('income')}>قائمة الدخل</button>
        <button type="button" className={tab === 'balance' ? 'active' : ''} onClick={() => setTab('balance')}>الميزانية العمومية</button>
      </div>

      <div className="statement-filters">
        {tab !== 'balance' ? <label>من<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label> : null}
        <label>{tab === 'balance' ? 'حتى تاريخ' : 'إلى'}<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
        {tab === 'ledger' ? <label>الحساب<select value={accountId} onChange={(event) => setAccountId(event.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name_ar}</option>)}</select></label> : null}
        <button type="button" onClick={() => void runStatement()} disabled={loading}>{loading ? 'جارٍ التحميل…' : 'تحديث'}</button>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      {tab === 'trial' ? <div className="account-table-wrap"><table className="account-table statement-table"><thead><tr><th>الكود</th><th>الحساب</th><th>النوع</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead><tbody>{trial.map((row) => <tr key={row.account_id}><td>{row.code}</td><td>{row.name_ar}</td><td>{row.account_type}</td><td>{row.total_debit.toFixed(2)}</td><td>{row.total_credit.toFixed(2)}</td><td>{row.balance.toFixed(2)}</td></tr>)}<tr className="statement-total"><td colSpan={3}>الإجمالي</td><td>{trialTotals.debit.toFixed(2)}</td><td>{trialTotals.credit.toFixed(2)}</td><td>{(trialTotals.debit-trialTotals.credit).toFixed(2)}</td></tr></tbody></table></div> : null}

      {tab === 'ledger' ? <div className="account-table-wrap"><table className="account-table statement-table"><thead><tr><th>التاريخ</th><th>القيد</th><th>البيان</th><th>المرجع</th><th>مدين</th><th>دائن</th><th>الرصيد الجاري</th></tr></thead><tbody>{ledger.map((row) => <tr key={`${row.journal_entry_id}-${row.entry_number}-${row.debit}-${row.credit}`}><td>{row.entry_date}</td><td>#{row.entry_number}</td><td>{row.memo || '—'}</td><td>{row.reference || '—'}</td><td>{row.debit.toFixed(2)}</td><td>{row.credit.toFixed(2)}</td><td>{row.running_balance.toFixed(2)}</td></tr>)}</tbody></table></div> : null}

      {tab === 'income' ? <div className="account-table-wrap"><table className="account-table statement-table"><thead><tr><th>الكود</th><th>الحساب</th><th>البند</th><th>القيمة</th></tr></thead><tbody>{income.map((row) => <tr key={row.account_id}><td>{row.code}</td><td>{row.name_ar}</td><td>{row.account_type === 'revenue' ? 'إيراد' : 'مصروف'}</td><td>{row.amount.toFixed(2)}</td></tr>)}<tr className="statement-total"><td colSpan={3}>صافي الربح / الخسارة</td><td>{(incomeTotals.revenue-incomeTotals.expense).toFixed(2)}</td></tr></tbody></table></div> : null}

      {tab === 'balance' ? <div className="account-table-wrap"><table className="account-table statement-table"><thead><tr><th>الكود</th><th>الحساب</th><th>النوع</th><th>القيمة</th></tr></thead><tbody>{balance.map((row) => <tr key={row.account_id ?? row.code}><td>{row.code}</td><td>{row.name_ar}</td><td>{row.account_type}</td><td>{row.amount.toFixed(2)}</td></tr>)}<tr className="statement-total"><td colSpan={3}>إجمالي الأصول</td><td>{balanceTotals.asset.toFixed(2)}</td></tr><tr className="statement-total"><td colSpan={3}>إجمالي الالتزامات + حقوق الملكية</td><td>{(balanceTotals.liability+balanceTotals.equity).toFixed(2)}</td></tr></tbody></table></div> : null}
    </section>
  )
}
