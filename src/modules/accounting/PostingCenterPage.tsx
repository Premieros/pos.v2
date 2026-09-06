import { useEffect, useMemo, useState } from 'react'
import { useBranch } from '../branches/useBranch'
import { usePermissions } from '../permissions/usePermissions'
import { listAccounts, type Account } from './account.service'
import { getPostingMapping, listSourcePostings, retrySourcePosting, setPostingMappings, type SourcePosting } from './posting.service'
import './accounting.css'

export function PostingCenterPage() {
  const { currentBranchId } = useBranch()
  const { can } = usePermissions()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [postings, setPostings] = useState<SourcePosting[]>([])
  const [mapping, setMapping] = useState<Record<string,string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canView = can('accounting.posting.view') || can('accounting.posting.manage') || can('accounting.posting.retry')
  const canManage = can('accounting.posting.manage')
  const canRetry = can('accounting.posting.retry')

  async function refresh() {
    if (!currentBranchId || !canView) return
    setLoading(true); setError(null)
    try {
      const [coa, sourceRows, current] = await Promise.all([listAccounts(currentBranchId), listSourcePostings(currentBranchId), getPostingMapping(currentBranchId)])
      setAccounts(coa.filter((a) => a.is_active && a.is_postable))
      setPostings(sourceRows)
      setMapping(current ? {
        salesRevenue: current.sales_revenue_account_id ?? '', salesCash: current.sales_cash_account_id ?? '', salesCard: current.sales_card_account_id ?? '',
        purchaseInventory: current.purchase_inventory_account_id ?? '', purchasePayable: current.purchase_payable_account_id ?? '',
      } : {})
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر تحميل ربط المحاسبة') }
    finally { setLoading(false) }
  }

  useEffect(() => { void refresh() }, [currentBranchId, canView])
  const revenue = useMemo(() => accounts.filter((a) => a.account_type === 'revenue'), [accounts])
  const assets = useMemo(() => accounts.filter((a) => a.account_type === 'asset'), [accounts])
  const liabilities = useMemo(() => accounts.filter((a) => a.account_type === 'liability'), [accounts])

  if (!currentBranchId || !canView) return null
  const branchId = currentBranchId

  function select(name: string, label: string, rows: Account[]) {
    return <label>{label}<select value={mapping[name] ?? ''} onChange={(e) => setMapping((old) => ({ ...old, [name]: e.target.value }))}><option value="">غير محدد</option>{rows.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name_ar}</option>)}</select></label>
  }

  async function save() {
    setError(null)
    try {
      await setPostingMappings({ branchId, salesRevenue: mapping.salesRevenue ?? '', salesCash: mapping.salesCash ?? '', salesCard: mapping.salesCard ?? '', purchaseInventory: mapping.purchaseInventory ?? '', purchasePayable: mapping.purchasePayable ?? '' })
      await refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر حفظ ربط المحاسبة') }
  }

  async function retry(row: SourcePosting) {
    setError(null)
    try { await retrySourcePosting(row.id); await refresh() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر إعادة محاولة الترحيل') }
  }

  return <section className="workspace-card accounting-workspace" aria-labelledby="posting-title">
    <div className="workspace-heading"><div><p className="eyebrow">Accounting Automation</p><h2 id="posting-title">ربط المصادر التشغيلية</h2><p>المبيعات واستلامات المشتريات تُربط تلقائيًا بالقيود عند اكتمال إعداد الحسابات، والمصادر القديمة أو الناقصة تبقى في قائمة انتظار قابلة لإعادة المحاولة.</p></div><span>{postings.filter((p) => p.status !== 'posted').length} معلّق</span></div>
    {error ? <p className="error-text">{error}</p> : null}{loading ? <p>جارٍ تحميل الربط…</p> : null}
    {canManage ? <div className="posting-map-form">
      {select('salesRevenue','إيراد المبيعات',revenue)}{select('salesCash','متحصلات نقدية',assets)}{select('salesCard','متحصلات بطاقات',assets)}{select('purchaseInventory','مخزون مشتريات',assets)}{select('purchasePayable','دائنون / مشتريات',liabilities)}
      <button type="button" onClick={() => void save()}>حفظ الربط</button>
    </div> : null}
    <div className="account-table-wrap"><table className="account-table posting-table"><thead><tr><th>المصدر</th><th>معرف المصدر</th><th>الحالة</th><th>القيد</th><th>الملاحظة</th>{canRetry ? <th>إجراء</th> : null}</tr></thead><tbody>{postings.map((row) => <tr key={row.id}><td>{row.source_type === 'pos_order' ? 'بيع POS' : 'استلام مشتريات'}</td><td>{row.source_id.slice(0,8)}</td><td>{row.status}</td><td>{row.journal_entry_id ? 'مرتبط' : '—'}</td><td>{row.last_error || '—'}</td>{canRetry ? <td>{row.status !== 'posted' ? <button type="button" onClick={() => void retry(row)}>إعادة المحاولة</button> : '—'}</td> : null}</tr>)}</tbody></table></div>
  </section>
}
