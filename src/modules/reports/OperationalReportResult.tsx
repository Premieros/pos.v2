import { useEffect, useMemo, useState } from 'react'
import type { ReportData } from './report.service'
import { exportRowsToExcel } from './excelExport'
import { printCurrentReport } from './reportPrint'

export type ReportColumn = { key: string; label: string; kind?: 'money' | 'number' | 'date' | 'boolean' | 'text' }

type Props = {
  reportKey: string
  reportTitle: string
  fromDate: string
  toDate: string
  columns: ReportColumn[]
  totalLabels: Record<string, string>
  data: ReportData | null
  loading: boolean
}

function display(value: unknown, kind: ReportColumn['kind'] = 'text') {
  if (value === null || value === undefined || value === '') return '—'
  if (kind === 'date') {
    const date = new Date(String(value))
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('ar-EG')
  }
  if (kind === 'money') {
    const number = Number(value)
    return Number.isFinite(number) ? number.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(value)
  }
  if (kind === 'number') {
    const number = Number(value)
    return Number.isFinite(number) ? number.toLocaleString('ar-EG', { maximumFractionDigits: 4 }) : String(value)
  }
  if (kind === 'boolean') return value ? 'نعم' : 'لا'
  const labels: Record<string, string> = { cash: 'كاش', card: 'بطاقة', dine_in: 'صالة', take_away: 'تيك أواي', drive_thru: 'درايف ثرو', delivery: 'دليفري', quick: 'سريع', return: 'مرتجع', refund: 'استرداد', void: 'إلغاء بعد المطبخ', discount: 'خصم', draft: 'مسودة', submitted: 'مرسل', partially_received: 'استلام جزئي', received: 'مستلم', cancelled: 'ملغي', posted: 'مرحّل', open: 'مفتوحة', closed: 'مغلقة' }
  return labels[String(value)] ?? String(value)
}

function totalKind(key: string): ReportColumn['kind'] {
  return ['order_count', 'invoice_count', 'payment_count', 'quantity', 'distinct_products', 'event_count', 'shift_count', 'purchase_count', 'ordered_quantity', 'received_quantity', 'item_rows', 'balance', 'inbound', 'outbound', 'low_stock_count', 'line_count', 'receipt_line_count'].includes(key) ? 'number' : 'money'
}

export function OperationalReportResult({ reportKey, reportTitle, fromDate, toDate, columns, totalLabels, data, loading }: Props) {
  const [visibleKeys, setVisibleKeys] = useState<string[]>(columns.map((column) => column.key))

  useEffect(() => {
    setVisibleKeys(columns.map((column) => column.key))
  }, [reportKey, columns])

  const visibleColumns = useMemo(() => columns.filter((column) => visibleKeys.includes(column.key)), [columns, visibleKeys])

  const toggleColumn = (key: string) => {
    setVisibleKeys((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])
  }

  const exportExcel = () => {
    if (!data) return
    exportRowsToExcel({
      fileName: `${reportTitle}-${fromDate}-${toDate}`,
      sheetName: reportTitle,
      columns: visibleColumns.map((column) => ({ key: column.key, label: column.label, value: (row: Record<string, unknown>) => row[column.key] })),
      rows: data.rows,
      totals: Object.entries(data.totals).map(([key, value]) => ({ label: totalLabels[key] ?? key, value })),
    })
  }

  if (loading) return <div className="report-contract-placeholder"><strong>جارٍ تحميل التقرير…</strong></div>
  if (!data) return null

  return (
    <>
      <div className="report-actions report-screen-only">
        <details className="report-column-picker">
          <summary>الأعمدة ({visibleColumns.length}/{columns.length})</summary>
          <div className="report-column-options">
            {columns.map((column) => <label key={column.key}><input type="checkbox" checked={visibleKeys.includes(column.key)} onChange={() => toggleColumn(column.key)} />{column.label}</label>)}
          </div>
        </details>
        <button type="button" onClick={exportExcel} disabled={visibleColumns.length === 0}>تصدير Excel</button>
        <button type="button" onClick={printCurrentReport}>طباعة التقرير</button>
      </div>

      <div className="report-totals" aria-label="إجماليات التقرير">
        {Object.entries(data.totals).map(([key, value]) => <article key={key}><small>{totalLabels[key] ?? key}</small><strong>{display(value, totalKind(key))}</strong></article>)}
      </div>

      {data.rows.length === 0 ? <div className="report-contract-placeholder"><strong>لا توجد بيانات مطابقة.</strong><p>غيّر الفترة أو الفلاتر لعرض نتائج أخرى.</p></div> : null}
      {data.rows.length > 0 && visibleColumns.length === 0 ? <div className="report-contract-placeholder"><strong>اختر عمودًا واحدًا على الأقل للعرض.</strong></div> : null}
      {data.rows.length > 0 && visibleColumns.length > 0 ? <div className="report-table-wrap"><table className="report-table"><thead><tr>{visibleColumns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{data.rows.map((row, index) => <tr key={`${reportKey}-${index}`}>{visibleColumns.map((column) => <td key={column.key}>{display(row[column.key], column.kind)}</td>)}</tr>)}</tbody></table></div> : null}
      <p className="report-generated-at">آخر توليد: {display(data.generated_at, 'date')}</p>
    </>
  )
}
