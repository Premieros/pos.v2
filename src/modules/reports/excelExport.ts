export type ExcelColumn<Row> = {
  key: string
  label: string
  value: (row: Row) => unknown
}

type ExportOptions<Row> = {
  fileName: string
  sheetName: string
  columns: ExcelColumn<Row>[]
  rows: Row[]
  totals?: Array<{ label: string; value: unknown }>
}

function xmlEscape(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function cell(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`
  }
  if (typeof value === 'boolean') {
    return `<Cell><Data ss:Type="String">${value ? 'نعم' : 'لا'}</Data></Cell>`
  }
  return `<Cell><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`
}

function safeSheetName(value: string) {
  return value.replace(/[\\/?*\[\]:]/g, ' ').slice(0, 31) || 'Report'
}

function safeFileName(value: string) {
  const cleaned = value.replace(/[\\/:*?"<>|]/g, '-').trim() || 'report'
  return cleaned.toLowerCase().endsWith('.xls') ? cleaned : `${cleaned}.xls`
}

export function exportRowsToExcel<Row>({ fileName, sheetName, columns, rows, totals = [] }: ExportOptions<Row>) {
  if (columns.length === 0) throw new Error('اختر عمودًا واحدًا على الأقل للتصدير')

  const header = `<Row>${columns.map((column) => cell(column.label)).join('')}</Row>`
  const body = rows.map((row) => `<Row>${columns.map((column) => cell(column.value(row))).join('')}</Row>`).join('')
  const totalsSheet = totals.length > 0
    ? `<Worksheet ss:Name="الإجماليات"><Table><Row>${cell('المؤشر')}${cell('القيمة')}</Row>${totals.map((item) => `<Row>${cell(item.label)}${cell(item.value)}</Row>`).join('')}</Table></Worksheet>`
    : ''

  const workbook = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="${xmlEscape(safeSheetName(sheetName))}"><Table>${header}${body}</Table></Worksheet>
  ${totalsSheet}
</Workbook>`

  const blob = new Blob(['\ufeff', workbook], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = safeFileName(fileName)
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
