import { useEffect, useMemo, useState } from 'react'
import {
  getBalanceSheet,
  getGeneralLedger,
  getIncomeStatement,
  getStatementAccounts,
  getTrialBalance,
  type BalanceSheetRow,
  type IncomeStatementRow,
  type LedgerRow,
  type StatementAccount,
  type TrialBalanceRow,
} from '../accounting/statements.service'
import { usePermissions } from '../permissions/usePermissions'

type StatementKey = 'trial' | 'ledger' | 'income' | 'balance'
type StatementRow = TrialBalanceRow | LedgerRow | IncomeStatementRow | BalanceSheetRow

type Props = {
  branchId: string
  fromDate: string
  toDate: string
}

const statementOptions: Array<{ key: StatementKey; label: string }> = [
  { key: 'trial', label: 'ميزان المراجعة' },
  { key: 'ledger', label: 'دفتر الأستاذ' },
  { key: 'income', label: 'قائمة الدخل' },
  { key: 'balance', label: 'الميزانية العمومية' },
]

function money(value: number) {
  return value.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function AccountingReportsPanel({ branchId, fromDate, toDate }: Props) {
  const { can } = usePermissions()
  const [statement, setStatement] = useState<StatementKey>('trial')
  const [accounts, setAccounts] = useState<StatementAccount[]>([])
  const [accountId, setAccountId] = useState('')
  const [rows, setRows] = useState<StatementRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allowed = can('accounting.statements.view')

  useEffect(() => {
    if (!allowed || !branchId) return
    void getStatementAccounts(branchId)
      .then((result) => {
        setAccounts(result)
        setAccountId((current) => current || result[0]?.id || '')
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'تعذر تحميل الحسابات'))
  }, [allowed, branchId])

  useEffect(() => {
    if (!allowed || !branchId || !fromDate || !toDate || fromDate > toDate) return
    if (statement === 'ledger' && !accountId) { setRows([]); return }
    setLoading(true)
    setError(null)
    const request = statement === 'trial'
      ? getTrialBalance(branchId, fromDate, toDate)
      : statement === 'ledger'
        ? getGeneralLedger(branchId, accountId, fromDate, toDate)
        : statement === 'income'
          ? getIncomeStatement(branchId, fromDate, toDate)
          : getBalanceSheet(branchId, toDate)
    void request
      .then((result) => setRows(result as StatementRow[]))
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'تعذر تحميل التقرير المحاسبي'))
      .finally(() => setLoading(false))
  }, [allowed, branchId, fromDate, toDate, statement, accountId])

  const totals = useMemo(() => {
    if (statement === 'trial') {
      const data = rows as TrialBalanceRow[]
      return { debit: data.reduce((sum, row) => sum + row.total_debit, 0), credit: data.reduce((sum, row) => sum + row.total_credit, 0) }
    }
    if (statement === 'ledger') {
      const data = rows as LedgerRow[]
      return { debit: data.reduce((sum, row) => sum + row.debit, 0), credit: data.reduce((sum, row) => sum + row.credit, 0), balance: data.at(-1)?.running_balance ?? 0 }
    }
    if (statement === 'income') {
      const data = rows as IncomeStatementRow[]
      const revenue = data.filter((row) => row.account_type === 'revenue').reduce((sum, row) => sum + row.amount, 0)
      const expense = data.filter((row) => row.account_type === 'expense').reduce((sum, row) => sum + row.amount, 0)
      return { revenue, expense, net: revenue - expense }
    }
    const data = rows as BalanceSheetRow[]
    const asset = data.filter((row) => row.account_type === 'asset').reduce((sum, row) => sum + row.amount, 0)
    const liability = data.filter((row) => row.account_type === 'liability').reduce((sum, row) => sum + row.amount, 0)
    const equity = data.filter((row) => row.account_type === 'equity').reduce((sum, row) => sum + row.amount, 0)
    return { asset, liability, equity }
  }, [rows, statement])

  if (!allowed) {
    return <div className="report-contract-placeholder"><strong>لا توجد صلاحية لعرض القوائم المالية.</strong><p>يتطلب هذا القسم صلاحية accounting.statements.view بالإضافة إلى الوصول لمركز التقارير.</p></div>
  }

  return (
    <div className="accounting-report-panel">
      <div className="accounting-report-tabs" aria-label="نوع التقرير المحاسبي">
        {statementOptions.map((option) => <button key={option.key} type="button" className={statement === option.key ? 'active' : ''} onClick={() => setStatement(option.key)}>{option.label}</button>)}
      </div>

      {statement === 'ledger' ? <label className="accounting-account-filter">الحساب<select value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">اختر حسابًا</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name_ar}</option>)}</select></label> : null}
      {error ? <p className="error-text">{error}</p> : null}
      {loading ? <div className="report-contract-placeholder"><strong>جارٍ تحميل التقرير المحاسبي…</strong></div> : null}

      {!loading && !error ? (
        <>
          <div className="report-totals">
            {statement === 'trial' ? <><article><small>إجمالي المدين</small><strong>{money(totals.debit ?? 0)}</strong></article><article><small>إجمالي الدائن</small><strong>{money(totals.credit ?? 0)}</strong></article></> : null}
            {statement === 'ledger' ? <><article><small>إجمالي المدين</small><strong>{money(totals.debit ?? 0)}</strong></article><article><small>إجمالي الدائن</small><strong>{money(totals.credit ?? 0)}</strong></article><article><small>الرصيد الختامي</small><strong>{money(totals.balance ?? 0)}</strong></article></> : null}
            {statement === 'income' ? <><article><small>الإيرادات</small><strong>{money(totals.revenue ?? 0)}</strong></article><article><small>المصروفات</small><strong>{money(totals.expense ?? 0)}</strong></article><article><small>صافي النتيجة</small><strong>{money(totals.net ?? 0)}</strong></article></> : null}
            {statement === 'balance' ? <><article><small>الأصول</small><strong>{money(totals.asset ?? 0)}</strong></article><article><small>الالتزامات</small><strong>{money(totals.liability ?? 0)}</strong></article><article><small>حقوق الملكية</small><strong>{money(totals.equity ?? 0)}</strong></article></> : null}
          </div>

          {rows.length === 0 ? <div className="report-contract-placeholder"><strong>لا توجد قيود مرحلة مطابقة.</strong></div> : null}

          {rows.length > 0 && statement === 'trial' ? <div className="report-table-wrap"><table className="report-table"><thead><tr><th>الكود</th><th>الحساب</th><th>النوع</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead><tbody>{(rows as TrialBalanceRow[]).map((row) => <tr key={row.account_id}><td>{row.code}</td><td>{row.name_ar}</td><td>{row.account_type}</td><td>{money(row.total_debit)}</td><td>{money(row.total_credit)}</td><td>{money(row.balance)}</td></tr>)}</tbody></table></div> : null}

          {rows.length > 0 && statement === 'ledger' ? <div className="report-table-wrap"><table className="report-table"><thead><tr><th>التاريخ</th><th>القيد</th><th>البيان</th><th>المرجع</th><th>مدين</th><th>دائن</th><th>الرصيد الجاري</th></tr></thead><tbody>{(rows as LedgerRow[]).map((row) => <tr key={`${row.journal_entry_id}-${row.entry_number}`}><td>{row.entry_date}</td><td>{row.entry_number}</td><td>{row.memo ?? '—'}</td><td>{row.reference ?? '—'}</td><td>{money(row.debit)}</td><td>{money(row.credit)}</td><td>{money(row.running_balance)}</td></tr>)}</tbody></table></div> : null}

          {rows.length > 0 && statement === 'income' ? <div className="report-table-wrap"><table className="report-table"><thead><tr><th>الكود</th><th>الحساب</th><th>النوع</th><th>القيمة</th></tr></thead><tbody>{(rows as IncomeStatementRow[]).map((row) => <tr key={row.account_id}><td>{row.code}</td><td>{row.name_ar}</td><td>{row.account_type === 'revenue' ? 'إيراد' : 'مصروف'}</td><td>{money(row.amount)}</td></tr>)}</tbody></table></div> : null}

          {rows.length > 0 && statement === 'balance' ? <div className="report-table-wrap"><table className="report-table"><thead><tr><th>الكود</th><th>الحساب</th><th>النوع</th><th>القيمة</th></tr></thead><tbody>{(rows as BalanceSheetRow[]).map((row, index) => <tr key={row.account_id ?? `synthetic-${index}`}><td>{row.code}</td><td>{row.name_ar}</td><td>{row.account_type}</td><td>{money(row.amount)}</td></tr>)}</tbody></table></div> : null}
        </>
      ) : null}
    </div>
  )
}
