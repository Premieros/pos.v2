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
import { exportRowsToExcel } from './excelExport'

type StatementKey = 'trial' | 'ledger' | 'income' | 'balance'
type StatementRow = TrialBalanceRow | LedgerRow | IncomeStatementRow | BalanceSheetRow

type Props = {
  branchId: string
  fromDate: string
  toDate: string
}

type AccountingColumn = {
  key: string
  label: string
  value: (row: StatementRow) => unknown
  format?: 'money' | 'date' | 'text'
}

const statementOptions: Array<{ key: StatementKey; label: string }> = [
  { key: 'trial', label: 'ميزان المراجعة' },
  { key: 'ledger', label: 'دفتر الأستاذ' },
  { key: 'income', label: 'قائمة الدخل' },
  { key: 'balance', label: 'الميزانية العمومية' },
]

const columnsByStatement: Record<StatementKey, AccountingColumn[]> = {
  trial: [
    { key: 'code', label: 'الكود', value: (row) => (row as TrialBalanceRow).code },
    { key: 'name_ar', label: 'الحساب', value: (row) => (row as TrialBalanceRow).name_ar },
    { key: 'account_type', label: 'النوع', value: (row) => (row as TrialBalanceRow).account_type },
    { key: 'total_debit', label: 'مدين', value: (row) => (row as TrialBalanceRow).total_debit, format: 'money' },
    { key: 'total_credit', label: 'دائن', value: (row) => (row as TrialBalanceRow).total_credit, format: 'money' },
    { key: 'balance', label: 'الرصيد', value: (row) => (row as TrialBalanceRow).balance, format: 'money' },
  ],
  ledger: [
    { key: 'entry_date', label: 'التاريخ', value: (row) => (row as LedgerRow).entry_date, format: 'date' },
    { key: 'entry_number', label: 'القيد', value: (row) => (row as LedgerRow).entry_number },
    { key: 'memo', label: 'البيان', value: (row) => (row as LedgerRow).memo ?? '' },
    { key: 'reference', label: 'المرجع', value: (row) => (row as LedgerRow).reference ?? '' },
    { key: 'debit', label: 'مدين', value: (row) => (row as LedgerRow).debit, format: 'money' },
    { key: 'credit', label: 'دائن', value: (row) => (row as LedgerRow).credit, format: 'money' },
    { key: 'running_balance', label: 'الرصيد الجاري', value: (row) => (row as LedgerRow).running_balance, format: 'money' },
  ],
  income: [
    { key: 'code', label: 'الكود', value: (row) => (row as IncomeStatementRow).code },
    { key: 'name_ar', label: 'الحساب', value: (row) => (row as IncomeStatementRow).name_ar },
    { key: 'account_type', label: 'النوع', value: (row) => (row as IncomeStatementRow).account_type === 'revenue' ? 'إيراد' : 'مصروف' },
    { key: 'amount', label: 'القيمة', value: (row) => (row as IncomeStatementRow).amount, format: 'money' },
  ],
  balance: [
    { key: 'code', label: 'الكود', value: (row) => (row as BalanceSheetRow).code },
    { key: 'name_ar', label: 'الحساب', value: (row) => (row as BalanceSheetRow).name_ar },
    { key: 'account_type', label: 'النوع', value: (row) => (row as BalanceSheetRow).account_type },
    { key: 'amount', label: 'القيمة', value: (row) => (row as BalanceSheetRow).amount, format: 'money' },
  ],
}

function money(value: number) {
  return value.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function display(value: unknown, format: AccountingColumn['format'] = 'text') {
  if (value === null || value === undefined || value === '') return '—'
  if (format === 'money') return money(Number(value))
  if (format === 'date') {
    const date = new Date(String(value))
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('ar-EG')
  }
  return String(value)
}

export function AccountingReportsPanel({ branchId, fromDate, toDate }: Props) {
  const { can } = usePermissions()
  const [statement, setStatement] = useState<StatementKey>('trial')
  const [accounts, setAccounts] = useState<StatementAccount[]>([])
  const [accountId, setAccountId] = useState('')
  const [rows, setRows] = useState<StatementRow[]>([])
  const [visibleKeys, setVisibleKeys] = useState<string[]>(columnsByStatement.trial.map((column) => column.key))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allowed = can('accounting.statements.view')
  const columns = columnsByStatement[statement]
  const visibleColumns = useMemo(() => columns.filter((column) => visibleKeys.includes(column.key)), [columns, visibleKeys])

  useEffect(() => {
    setVisibleKeys(columnsByStatement[statement].map((column) => column.key))
  }, [statement])

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
    return {
      asset: data.filter((row) => row.account_type === 'asset').reduce((sum, row) => sum + row.amount, 0),
      liability: data.filter((row) => row.account_type === 'liability').reduce((sum, row) => sum + row.amount, 0),
      equity: data.filter((row) => row.account_type === 'equity').reduce((sum, row) => sum + row.amount, 0),
    }
  }, [rows, statement])

  const exportTotals = useMemo(() => {
    if (statement === 'trial') return [{ label: 'إجمالي المدين', value: totals.debit ?? 0 }, { label: 'إجمالي الدائن', value: totals.credit ?? 0 }]
    if (statement === 'ledger') return [{ label: 'إجمالي المدين', value: totals.debit ?? 0 }, { label: 'إجمالي الدائن', value: totals.credit ?? 0 }, { label: 'الرصيد الختامي', value: totals.balance ?? 0 }]
    if (statement === 'income') return [{ label: 'الإيرادات', value: totals.revenue ?? 0 }, { label: 'المصروفات', value: totals.expense ?? 0 }, { label: 'صافي النتيجة', value: totals.net ?? 0 }]
    return [{ label: 'الأصول', value: totals.asset ?? 0 }, { label: 'الالتزامات', value: totals.liability ?? 0 }, { label: 'حقوق الملكية', value: totals.equity ?? 0 }]
  }, [statement, totals])

  if (!allowed) {
    return <div className="report-contract-placeholder"><strong>لا توجد صلاحية لعرض القوائم المالية.</strong><p>يتطلب هذا القسم صلاحية accounting.statements.view بالإضافة إلى الوصول لمركز التقارير.</p></div>
  }

  const toggleColumn = (key: string) => setVisibleKeys((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])
  const title = statementOptions.find((option) => option.key === statement)?.label ?? 'تقرير محاسبي'
  const selectedAccount = accounts.find((account) => account.id === accountId)
  const exportExcel = () => exportRowsToExcel({
    fileName: `${title}${selectedAccount && statement === 'ledger' ? `-${selectedAccount.code}` : ''}-${fromDate}-${toDate}`,
    sheetName: title,
    columns: visibleColumns.map((column) => ({ key: column.key, label: column.label, value: column.value })),
    rows,
    totals: exportTotals,
  })

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
          <div className="report-actions">
            <details className="report-column-picker">
              <summary>الأعمدة ({visibleColumns.length}/{columns.length})</summary>
              <div className="report-column-options">{columns.map((column) => <label key={column.key}><input type="checkbox" checked={visibleKeys.includes(column.key)} onChange={() => toggleColumn(column.key)} />{column.label}</label>)}</div>
            </details>
            <button type="button" onClick={exportExcel} disabled={visibleColumns.length === 0}>تصدير Excel</button>
          </div>

          <div className="report-totals">{exportTotals.map((item) => <article key={item.label}><small>{item.label}</small><strong>{money(Number(item.value))}</strong></article>)}</div>
          {rows.length === 0 ? <div className="report-contract-placeholder"><strong>لا توجد قيود مرحلة مطابقة.</strong></div> : null}
          {rows.length > 0 && visibleColumns.length === 0 ? <div className="report-contract-placeholder"><strong>اختر عمودًا واحدًا على الأقل للعرض.</strong></div> : null}
          {rows.length > 0 && visibleColumns.length > 0 ? <div className="report-table-wrap"><table className="report-table"><thead><tr>{visibleColumns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${statement}-${index}`}>{visibleColumns.map((column) => <td key={column.key}>{display(column.value(row), column.format)}</td>)}</tr>)}</tbody></table></div> : null}
        </>
      ) : null}
    </div>
  )
}
