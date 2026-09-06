import { useEffect, useMemo, useState } from 'react'
import { useBranch } from '../branches/useBranch'
import { usePermissions } from '../permissions/usePermissions'
import { listAccounts, type Account } from './account.service'
import { addJournalLine, createJournalEntry, listJournalEntries, listJournalLines, postJournalEntry, removeJournalLine, reverseJournalEntry, type JournalEntry, type JournalLine } from './journal.service'
import './accounting.css'

export function JournalPage() {
  const { currentBranchId } = useBranch()
  const { can } = usePermissions()
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [lines, setLines] = useState<JournalLine[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reversalReason, setReversalReason] = useState('')

  const canView = can('accounting.journals.view') || can('accounting.journals.create') || can('accounting.journals.edit') || can('accounting.journals.post') || can('accounting.journals.reverse')
  const canCreate = can('accounting.journals.create')
  const canEdit = can('accounting.journals.edit')
  const canPost = can('accounting.journals.post')
  const canReverse = can('accounting.journals.reverse')
  const selected = entries.find((entry) => entry.id === selectedId) ?? null

  async function refreshEntries() {
    if (!currentBranchId || !canView) return
    setLoading(true)
    setError(null)
    try {
      const [entryRows, accountRows] = await Promise.all([listJournalEntries(currentBranchId), listAccounts(currentBranchId)])
      setEntries(entryRows)
      setAccounts(accountRows.filter((account) => account.is_active && account.is_postable))
      if (!selectedId && entryRows.length) setSelectedId(entryRows[0].id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل القيود اليومية')
    } finally {
      setLoading(false)
    }
  }

  async function refreshLines(entryId: string | null) {
    if (!entryId) { setLines([]); return }
    try {
      setLines(await listJournalLines(entryId))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل بنود القيد')
    }
  }

  useEffect(() => { void refreshEntries() }, [currentBranchId, canView])
  useEffect(() => { void refreshLines(selectedId) }, [selectedId])

  const totals = useMemo(() => lines.reduce((sum, line) => ({ debit: sum.debit + line.debit, credit: sum.credit + line.credit }), { debit: 0, credit: 0 }), [lines])
  const accountNames = useMemo(() => new Map(accounts.map((account) => [account.id, `${account.code} — ${account.name_ar}`])), [accounts])

  if (!currentBranchId || !canView) return null
  const branchId = currentBranchId

  async function handleCreate(form: HTMLFormElement) {
    const data = new FormData(form)
    setError(null)
    try {
      const id = await createJournalEntry({
        branchId,
        entryDate: String(data.get('entryDate') ?? ''),
        memo: String(data.get('memo') ?? ''),
        reference: String(data.get('reference') ?? ''),
        idempotencyKey: `manual-journal:${crypto.randomUUID()}`,
      })
      form.reset()
      await refreshEntries()
      setSelectedId(id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر إنشاء القيد')
    }
  }

  async function handleAddLine(form: HTMLFormElement) {
    if (!selected) return
    const data = new FormData(form)
    setError(null)
    try {
      await addJournalLine({
        entryId: selected.id,
        accountId: String(data.get('accountId') ?? ''),
        debit: Number(data.get('debit') ?? 0),
        credit: Number(data.get('credit') ?? 0),
        description: String(data.get('description') ?? ''),
      })
      form.reset()
      await refreshLines(selected.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر إضافة بند القيد')
    }
  }

  async function handleRemove(lineId: string) {
    if (!selected) return
    setError(null)
    try {
      await removeJournalLine(lineId)
      await refreshLines(selected.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر حذف بند القيد')
    }
  }

  async function handlePost() {
    if (!selected) return
    setError(null)
    try {
      await postJournalEntry(selected.id)
      await refreshEntries()
      await refreshLines(selected.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر ترحيل القيد')
    }
  }

  async function handleReverse() {
    if (!selected || !reversalReason.trim()) return
    setError(null)
    try {
      const reversalId = await reverseJournalEntry(selected.id, reversalReason)
      setReversalReason('')
      await refreshEntries()
      setSelectedId(reversalId)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر عكس القيد')
    }
  }

  return (
    <section className="workspace-card accounting-workspace" aria-labelledby="journals-title">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">Accounting</p>
          <h2 id="journals-title">القيود اليومية</h2>
          <p>إنشاء وترحيل القيود المتوازنة، وتصحيح القيود المرحلة بعكس محاسبي مستقل دون تعديل الأصل.</p>
        </div>
        <span>{entries.filter((entry) => entry.status === 'draft').length} مسودة</span>
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {loading ? <p>جارٍ تحميل القيود…</p> : null}

      {canCreate ? (
        <form className="journal-create-form" onSubmit={(event) => { event.preventDefault(); void handleCreate(event.currentTarget) }}>
          <input name="entryDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
          <input name="memo" placeholder="بيان القيد" />
          <input name="reference" placeholder="مرجع اختياري" />
          <button type="submit">قيد جديد</button>
        </form>
      ) : null}

      <div className="journal-layout">
        <aside className="journal-list">
          {entries.map((entry) => (
            <button key={entry.id} type="button" className={selectedId === entry.id ? 'journal-entry active' : 'journal-entry'} onClick={() => setSelectedId(entry.id)}>
              <strong>#{entry.entry_number}</strong>
              <span>{entry.entry_date}</span>
              <small>{entry.memo || 'بدون بيان'}</small>
              <em>{entry.status === 'draft' ? 'مسودة' : 'مرحّل'}</em>
            </button>
          ))}
          {!loading && !entries.length ? <p className="muted-text">لا توجد قيود بعد.</p> : null}
        </aside>

        <div className="journal-detail">
          {!selected ? <p className="muted-text">اختر قيدًا لعرض بنوده.</p> : (
            <>
              <div className="journal-summary">
                <div><strong>القيد #{selected.entry_number}</strong><span>{selected.entry_date}</span></div>
                <div><span>مدين</span><strong>{totals.debit.toFixed(2)}</strong></div>
                <div><span>دائن</span><strong>{totals.credit.toFixed(2)}</strong></div>
                <div><span>الفرق</span><strong>{Math.abs(totals.debit - totals.credit).toFixed(2)}</strong></div>
              </div>

              {selected.status === 'draft' && canEdit ? (
                <form className="journal-line-form" onSubmit={(event) => { event.preventDefault(); void handleAddLine(event.currentTarget) }}>
                  <select name="accountId" required defaultValue=""><option value="" disabled>اختر الحساب</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name_ar}</option>)}</select>
                  <input name="debit" type="number" min="0" step="0.01" defaultValue="0" placeholder="مدين" />
                  <input name="credit" type="number" min="0" step="0.01" defaultValue="0" placeholder="دائن" />
                  <input name="description" placeholder="بيان البند" />
                  <button type="submit">إضافة بند</button>
                </form>
              ) : null}

              <div className="account-table-wrap">
                <table className="account-table journal-lines-table">
                  <thead><tr><th>#</th><th>الحساب</th><th>البيان</th><th>مدين</th><th>دائن</th>{selected.status === 'draft' && canEdit ? <th>إجراء</th> : null}</tr></thead>
                  <tbody>
                    {lines.map((line) => <tr key={line.id}><td>{line.line_no}</td><td>{accountNames.get(line.account_id) ?? line.account_id}</td><td>{line.description || '—'}</td><td>{line.debit.toFixed(2)}</td><td>{line.credit.toFixed(2)}</td>{selected.status === 'draft' && canEdit ? <td><button type="button" onClick={() => void handleRemove(line.id)}>حذف</button></td> : null}</tr>)}
                  </tbody>
                </table>
              </div>

              {selected.status === 'draft' && canPost ? <button className="journal-post-button" type="button" onClick={() => void handlePost()} disabled={lines.length < 2 || totals.debit <= 0 || totals.debit !== totals.credit}>ترحيل القيد المتوازن</button> : null}

              {selected.status === 'posted' && canReverse && selected.source_type !== 'journal_reversal' ? (
                <div className="journal-reversal-box">
                  <input value={reversalReason} onChange={(event) => setReversalReason(event.target.value)} placeholder="سبب العكس المحاسبي" />
                  <button type="button" onClick={() => void handleReverse()} disabled={!reversalReason.trim()}>إنشاء قيد عكسي</button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
