import { useEffect, useMemo, useState } from 'react'
import { useBranch } from '../branches/useBranch'
import { usePermissions } from '../permissions/usePermissions'
import { createAccount, listAccounts, updateAccount, type Account, type AccountType } from './account.service'
import './accounting.css'

const typeLabels: Record<AccountType, string> = {
  asset: 'أصول',
  liability: 'التزامات',
  equity: 'حقوق ملكية',
  revenue: 'إيرادات',
  expense: 'مصروفات',
}

export function ChartOfAccountsPage() {
  const { currentBranchId } = useBranch()
  const { can } = usePermissions()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accountType, setAccountType] = useState<AccountType>('asset')

  const canView = can('accounting.coa.view') || can('accounting.coa.manage')
  const canManage = can('accounting.coa.manage')

  async function refresh() {
    if (!currentBranchId || !canView) return
    setLoading(true)
    setError(null)
    try {
      setAccounts(await listAccounts(currentBranchId))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل دليل الحسابات')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [currentBranchId, canView])

  const parentOptions = useMemo(
    () => accounts.filter((account) => account.account_type === accountType && !account.is_postable && account.is_active),
    [accounts, accountType],
  )

  if (!currentBranchId || !canView) return null
  const branchId = currentBranchId

  async function handleCreate(form: HTMLFormElement) {
    const data = new FormData(form)
    setError(null)
    try {
      await createAccount({
        branchId,
        code: String(data.get('code') ?? ''),
        nameAr: String(data.get('nameAr') ?? ''),
        nameEn: String(data.get('nameEn') ?? ''),
        accountType,
        parentId: String(data.get('parentId') ?? '') || null,
        isPostable: data.get('isPostable') === 'on',
        description: String(data.get('description') ?? ''),
      })
      form.reset()
      setAccountType('asset')
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر إنشاء الحساب')
    }
  }

  async function toggleAccount(account: Account) {
    setError(null)
    try {
      await updateAccount({
        accountId: account.id,
        code: account.code,
        nameAr: account.name_ar,
        nameEn: account.name_en,
        parentId: account.parent_id,
        isPostable: account.is_postable,
        isActive: !account.is_active,
        description: account.description,
      })
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحديث الحساب')
    }
  }

  const parentName = new Map(accounts.map((account) => [account.id, `${account.code} — ${account.name_ar}`]))

  return (
    <section className="workspace-card accounting-workspace" aria-labelledby="coa-title">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">Accounting</p>
          <h2 id="coa-title">دليل الحسابات</h2>
          <p>دليل حسابات معزول حسب الفرع، بهيكل هرمي واضح وحسابات رئيسية أو قابلة للترحيل.</p>
        </div>
        <span>{accounts.filter((account) => account.is_active).length} حساب نشط</span>
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {loading ? <p>جارٍ تحميل دليل الحسابات…</p> : null}

      {canManage ? (
        <form className="account-form" onSubmit={(event) => { event.preventDefault(); void handleCreate(event.currentTarget) }}>
          <input name="code" required placeholder="كود الحساب" />
          <input name="nameAr" required placeholder="اسم الحساب بالعربية" />
          <input name="nameEn" placeholder="الاسم بالإنجليزية" />
          <select value={accountType} onChange={(event) => setAccountType(event.target.value as AccountType)} aria-label="نوع الحساب">
            {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select name="parentId" defaultValue="" aria-label="الحساب الأب">
            <option value="">بدون حساب أب</option>
            {parentOptions.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name_ar}</option>)}
          </select>
          <input name="description" placeholder="وصف مختصر" />
          <label className="account-check"><input name="isPostable" type="checkbox" defaultChecked /> قابل للترحيل</label>
          <button type="submit">إضافة حساب</button>
        </form>
      ) : null}

      <div className="account-table-wrap">
        <table className="account-table">
          <thead><tr><th>الكود</th><th>الحساب</th><th>النوع</th><th>الطبيعة</th><th>الأب</th><th>الترحيل</th><th>الحالة</th>{canManage ? <th>إجراء</th> : null}</tr></thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id}>
                <td>{account.code}</td>
                <td><strong>{account.name_ar}</strong>{account.name_en ? <small>{account.name_en}</small> : null}</td>
                <td>{typeLabels[account.account_type]}</td>
                <td>{account.normal_balance === 'debit' ? 'مدين' : 'دائن'}</td>
                <td>{account.parent_id ? parentName.get(account.parent_id) ?? '—' : '—'}</td>
                <td>{account.is_postable ? 'نعم' : 'رئيسي'}</td>
                <td>{account.is_active ? 'نشط' : 'موقوف'}</td>
                {canManage ? <td><button type="button" onClick={() => void toggleAccount(account)}>{account.is_active ? 'إيقاف' : 'تفعيل'}</button></td> : null}
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !accounts.length ? <p className="muted-text">لا توجد حسابات في هذا الفرع بعد.</p> : null}
      </div>
    </section>
  )
}
