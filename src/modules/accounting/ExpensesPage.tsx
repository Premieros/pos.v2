import { useEffect, useMemo, useState } from 'react'
import { useBranch } from '../branches/useBranch'
import { usePermissions } from '../permissions/usePermissions'
import { listAccounts, type Account } from './account.service'
import { createExpenseDocument, listExpenseDocuments, postExpenseDocument, type ExpenseDocument } from './expense.service'
import './accounting.css'

export function ExpensesPage() {
  const { currentBranchId } = useBranch()
  const { can } = usePermissions()
  const [expenses, setExpenses] = useState<ExpenseDocument[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canView = can('accounting.expenses.view') || can('accounting.expenses.create') || can('accounting.expenses.edit') || can('accounting.expenses.post')
  const canCreate = can('accounting.expenses.create')
  const canPost = can('accounting.expenses.post')

  async function refresh() {
    if (!currentBranchId || !canView) return
    setLoading(true)
    setError(null)
    try {
      const [expenseRows, accountRows] = await Promise.all([listExpenseDocuments(currentBranchId), listAccounts(currentBranchId)])
      setExpenses(expenseRows)
      setAccounts(accountRows.filter((account) => account.is_active && account.is_postable))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل المصروفات')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [currentBranchId, canView])

  const expenseAccounts = useMemo(() => accounts.filter((account) => account.account_type === 'expense'), [accounts])
  const accountNames = useMemo(() => new Map(accounts.map((account) => [account.id, `${account.code} — ${account.name_ar}`])), [accounts])

  if (!currentBranchId || !canView) return null
  const branchId = currentBranchId

  async function handleCreate(form: HTMLFormElement) {
    const data = new FormData(form)
    setError(null)
    try {
      await createExpenseDocument({
        branchId,
        expenseDate: String(data.get('expenseDate') ?? ''),
        amount: Number(data.get('amount') ?? 0),
        expenseAccountId: String(data.get('expenseAccountId') ?? ''),
        offsetAccountId: String(data.get('offsetAccountId') ?? ''),
        payee: String(data.get('payee') ?? ''),
        description: String(data.get('description') ?? ''),
        reference: String(data.get('reference') ?? ''),
        idempotencyKey: `expense:${crypto.randomUUID()}`,
      })
      form.reset()
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر إنشاء المصروف')
    }
  }

  async function handlePost(expense: ExpenseDocument) {
    setError(null)
    try {
      await postExpenseDocument(expense.id)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر ترحيل المصروف')
    }
  }

  return (
    <section className="workspace-card accounting-workspace" aria-labelledby="expenses-title">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">Accounting</p>
          <h2 id="expenses-title">المصروفات</h2>
          <p>مستند مصروف مستقل، يرحّل مرة واحدة فقط إلى قيد محاسبي مرتبط بالمصدر.</p>
        </div>
        <span>{expenses.filter((expense) => expense.status === 'draft').length} مسودة</span>
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {loading ? <p>جارٍ تحميل المصروفات…</p> : null}

      {canCreate ? (
        <form className="expense-form" onSubmit={(event) => { event.preventDefault(); void handleCreate(event.currentTarget) }}>
          <input name="expenseDate" type="date" required defaultValue={new Date().toISOString().slice(0,10)} />
          <input name="amount" type="number" min="0.01" step="0.01" required placeholder="القيمة" />
          <select name="expenseAccountId" required defaultValue=""><option value="" disabled>حساب المصروف</option>{expenseAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name_ar}</option>)}</select>
          <select name="offsetAccountId" required defaultValue=""><option value="" disabled>الحساب المقابل</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name_ar}</option>)}</select>
          <input name="payee" placeholder="المستفيد / المورد" />
          <input name="description" required placeholder="بيان المصروف" />
          <input name="reference" placeholder="مرجع اختياري" />
          <button type="submit">إضافة مصروف</button>
        </form>
      ) : null}

      <div className="account-table-wrap">
        <table className="account-table expense-table">
          <thead><tr><th>#</th><th>التاريخ</th><th>البيان</th><th>المستفيد</th><th>حساب المصروف</th><th>المقابل</th><th>القيمة</th><th>الحالة</th><th>القيد</th>{canPost ? <th>إجراء</th> : null}</tr></thead>
          <tbody>
            {expenses.map((expense) => (
              <tr key={expense.id}>
                <td>{expense.expense_number}</td>
                <td>{expense.expense_date}</td>
                <td>{expense.description}</td>
                <td>{expense.payee || '—'}</td>
                <td>{accountNames.get(expense.expense_account_id) ?? '—'}</td>
                <td>{accountNames.get(expense.offset_account_id) ?? '—'}</td>
                <td>{expense.amount.toFixed(2)}</td>
                <td>{expense.status === 'draft' ? 'مسودة' : expense.status === 'posted' ? 'مرحّل' : 'معكوس'}</td>
                <td>{expense.journal_entry_id ? 'مرتبط' : '—'}</td>
                {canPost ? <td>{expense.status === 'draft' ? <button type="button" onClick={() => void handlePost(expense)}>ترحيل</button> : '—'}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !expenses.length ? <p className="muted-text">لا توجد مصروفات في هذا الفرع بعد.</p> : null}
      </div>
    </section>
  )
}
