import { existsSync, readFileSync } from 'node:fs'

function read(path) {
  if (!existsSync(path)) throw new Error(`Missing required file: ${path}`)
  return readFileSync(path, 'utf8')
}

function requireText(path, snippets) {
  const text = read(path)
  for (const snippet of snippets) {
    if (!text.includes(snippet)) throw new Error(`${path} is missing Batch 8 contract marker: ${snippet}`)
  }
}

for (const [path, snippets] of [
  ['supabase/migrations/20260905192644_unified_reports_foundation.sql', ['reports.view', 'get_report_filter_options', 'assert_report_access']],
  ['supabase/migrations/20260905193209_sales_operations_report_projections.sql', ['get_sales_operations_report', 'cashiers', 'returns']],
  ['supabase/migrations/20260905194116_procurement_inventory_report_projections.sql', ['get_procurement_inventory_report', 'purchases', 'inventory', 'waste']],
  ['supabase/migrations/20260905194501_purchase_cost_history_report_projection.sql', ['get_purchase_cost_history_report', 'inventory_item_purchase_cost_history', 'weighted_avg_cost']],
]) requireText(path, snippets)

requireText('docs/DATABASE_IDENTITY_LOCK.md', ['scpovyrqmsbiduanykod'])
requireText('.github/workflows/verify.yml', ['https://scpovyrqmsbiduanykod.supabase.co'])
requireText('src/modules/reports/ReportsPage.tsx', ['reports.view', 'OperationalReportResult', 'AccountingReportsPanel'])
requireText('src/modules/reports/OperationalReportResult.tsx', ['exportRowsToExcel', 'printCurrentReport', 'visibleKeys'])
requireText('src/modules/reports/AccountingReportsPanel.tsx', ['accounting.statements.view', 'getTrialBalance', 'getGeneralLedger', 'getIncomeStatement', 'getBalanceSheet', 'exportRowsToExcel', 'printCurrentReport'])
requireText('src/modules/reports/excelExport.ts', ['urn:schemas-microsoft-com:office:spreadsheet', 'application/vnd.ms-excel', 'totals'])
requireText('src/modules/printing/PrintingCenterPage.tsx', ['getReceiptPrintState', 'registerFirstReceiptPrint', 'registerReceiptReprint', 'listPrintableKitchenTickets', 'listPrintableShifts', 'getDaySummary'])
requireText('src/app/App.tsx', ['PrintingCenterPage', "can('pos.receipt.print')", "can('pos.receipt.reprint')"])

const guardedSources = [
  'src/modules/reports/ReportsPage.tsx',
  'src/modules/reports/OperationalReportResult.tsx',
  'src/modules/reports/AccountingReportsPanel.tsx',
  'src/modules/reports/report.service.ts',
  'src/modules/printing/PrintingCenterPage.tsx',
  'src/modules/printing/printing.service.ts',
].map(read).join('\n')

if (/role\s*===|role_name\s*===|\.role\s*===/.test(guardedSources)) {
  throw new Error('Role-label authorization detected in Batch 8 feature code')
}

for (const marker of [
  ".from('receipt_documents').insert",
  ".from('receipt_print_events').insert",
  ".from('kitchen_tickets').update",
  ".from('shifts').update",
]) {
  if (guardedSources.includes(marker)) throw new Error(`Direct protected write reintroduced in Batch 8: ${marker}`)
}

const printCenter = read('src/modules/printing/PrintingCenterPage.tsx')
if (!printCenter.includes('state.hasReceipt') || !printCenter.includes('سبب إعادة الطباعة إلزامي')) {
  throw new Error('Receipt first/reprint state contract is not preserved in central printing')
}

console.log('Batch 8 repository contract regression guard: PASS')
