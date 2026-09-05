import { useEffect, useMemo, useState } from 'react'
import { useBranch } from '../branches/useBranch'
import { usePermissions } from '../permissions/usePermissions'
import { AccountingReportsPanel } from './AccountingReportsPanel'
import { OperationalReportResult, type ReportColumn } from './OperationalReportResult'
import {
  getProcurementInventoryReport,
  getPurchaseCostHistoryReport,
  getReportFilterOptions,
  getSalesOperationsReport,
  type ProcurementInventoryReportKey,
  type ReportData,
  type ReportFilterOptions,
  type ReportFilters,
  type SalesOperationsReportKey,
} from './report.service'
import './reports.css'

type ReportKey = SalesOperationsReportKey | ProcurementInventoryReportKey | 'costs' | 'accounting'

const reports: Array<{ key: ReportKey; title: string; description: string; batch: string }> = [
  { key: 'sales', title: 'ملخص المبيعات', description: 'إجماليات البيع حسب الفترة والفلاتر.', batch: '8.2' },
  { key: 'invoices', title: 'الفواتير التفصيلية', description: 'كل فاتورة وحالتها ومدفوعاتها.', batch: '8.2' },
  { key: 'payments', title: 'المبيعات حسب طريقة الدفع', description: 'كاش / بطاقة مع الإجماليات.', batch: '8.2' },
  { key: 'employees', title: 'المبيعات حسب الموظف', description: 'أداء المبيعات والتحصيل حسب الموظف.', batch: '8.2' },
  { key: 'products', title: 'المبيعات حسب المنتج', description: 'الكميات والقيم لكل منتج.', batch: '8.2' },
  { key: 'returns', title: 'المرتجعات والخصومات والإلغاءات', description: 'حركات التحكم التشغيلي وأثرها المالي.', batch: '8.2' },
  { key: 'cashiers', title: 'أداء الكاشير والورديات', description: 'التحصيل والفروقات النقدية حسب الوردية.', batch: '8.2' },
  { key: 'purchases', title: 'المشتريات والموردون', description: 'أوامر الشراء والاستلامات والقيمة المستلمة.', batch: '8.3' },
  { key: 'inventory', title: 'المخزون والحركات', description: 'الرصيد الحالي والوارد والصادر وحد إعادة الطلب.', batch: '8.3' },
  { key: 'waste', title: 'الهالك', description: 'تفاصيل مستندات الهالك والكميات والمخازن.', batch: '8.3' },
  { key: 'costs', title: 'سجل تكلفة الشراء', description: 'التكلفة التاريخية الفعلية لكل استلام وصنف.', batch: '8.3' },
  { key: 'accounting', title: 'التقارير المحاسبية', description: 'ميزان المراجعة ودفتر الأستاذ والقوائم المالية.', batch: '8.4' },
]

const columnsByReport: Partial<Record<ReportKey, ReportColumn[]>> = {
  sales: [{ key: 'metric', label: 'المؤشر' }, { key: 'value', label: 'القيمة', kind: 'money' }],
  invoices: [
    { key: 'order_number', label: 'الفاتورة' }, { key: 'created_at', label: 'التاريخ', kind: 'date' }, { key: 'order_type', label: 'نوع الطلب' }, { key: 'status', label: 'الحالة' }, { key: 'employee', label: 'الموظف' },
    { key: 'subtotal', label: 'قبل الخصم', kind: 'money' }, { key: 'discount', label: 'الخصم', kind: 'money' }, { key: 'total', label: 'الإجمالي', kind: 'money' }, { key: 'paid', label: 'المدفوع', kind: 'money' }, { key: 'refund', label: 'المسترد', kind: 'money' }, { key: 'net', label: 'الصافي', kind: 'money' },
  ],
  payments: [{ key: 'method', label: 'طريقة الدفع' }, { key: 'payment_count', label: 'عدد الدفعات', kind: 'number' }, { key: 'amount', label: 'القيمة', kind: 'money' }],
  employees: [{ key: 'employee', label: 'الموظف' }, { key: 'order_count', label: 'الطلبات', kind: 'number' }, { key: 'gross_sales', label: 'إجمالي المبيعات', kind: 'money' }, { key: 'paid', label: 'التحصيل', kind: 'money' }],
  products: [{ key: 'product', label: 'المنتج' }, { key: 'quantity', label: 'الكمية', kind: 'number' }, { key: 'order_count', label: 'الطلبات', kind: 'number' }, { key: 'gross_sales', label: 'المبيعات', kind: 'money' }],
  returns: [{ key: 'event_at', label: 'التاريخ', kind: 'date' }, { key: 'event_type', label: 'النوع' }, { key: 'order_number', label: 'الفاتورة' }, { key: 'employee', label: 'الموظف' }, { key: 'reason', label: 'السبب' }, { key: 'amount', label: 'القيمة', kind: 'money' }],
  cashiers: [
    { key: 'employee', label: 'الكاشير' }, { key: 'status', label: 'الحالة' }, { key: 'opened_at', label: 'فتح الوردية', kind: 'date' }, { key: 'closed_at', label: 'إغلاق الوردية', kind: 'date' }, { key: 'opening_balance', label: 'رصيد الفتح', kind: 'money' },
    { key: 'payments_total', label: 'التحصيل', kind: 'money' }, { key: 'refunds_total', label: 'المرتجعات', kind: 'money' }, { key: 'expected_cash', label: 'النقد المتوقع', kind: 'money' }, { key: 'actual_cash', label: 'النقد الفعلي', kind: 'money' }, { key: 'cash_difference', label: 'الفرق', kind: 'money' },
  ],
  purchases: [
    { key: 'purchase_number', label: 'أمر الشراء' }, { key: 'created_at', label: 'التاريخ', kind: 'date' }, { key: 'supplier', label: 'المورد' }, { key: 'status', label: 'الحالة' }, { key: 'ordered_quantity', label: 'الكمية المطلوبة', kind: 'number' }, { key: 'received_quantity', label: 'الكمية المستلمة', kind: 'number' }, { key: 'total', label: 'قيمة الأمر', kind: 'money' }, { key: 'received_value', label: 'قيمة المستلم', kind: 'money' },
  ],
  inventory: [
    { key: 'code', label: 'الكود' }, { key: 'item', label: 'الصنف' }, { key: 'warehouse', label: 'المخزن' }, { key: 'base_unit', label: 'الوحدة' }, { key: 'balance', label: 'الرصيد الحالي', kind: 'number' }, { key: 'minimum_level', label: 'الحد الأدنى', kind: 'number' }, { key: 'below_minimum', label: 'منخفض', kind: 'boolean' }, { key: 'inbound', label: 'الوارد بالفترة', kind: 'number' }, { key: 'outbound', label: 'الصادر بالفترة', kind: 'number' },
  ],
  waste: [
    { key: 'event_at', label: 'التاريخ', kind: 'date' }, { key: 'status', label: 'الحالة' }, { key: 'warehouse', label: 'المخزن' }, { key: 'code', label: 'الكود' }, { key: 'item', label: 'الصنف' }, { key: 'quantity', label: 'الكمية', kind: 'number' }, { key: 'base_unit', label: 'الوحدة' }, { key: 'reason', label: 'السبب' }, { key: 'note', label: 'ملاحظة' },
  ],
  costs: [
    { key: 'received_at', label: 'تاريخ الاستلام', kind: 'date' }, { key: 'purchase_number', label: 'أمر الشراء' }, { key: 'supplier', label: 'المورد' }, { key: 'warehouse', label: 'المخزن' }, { key: 'code', label: 'الكود' }, { key: 'item', label: 'الصنف' }, { key: 'quantity', label: 'الكمية', kind: 'number' }, { key: 'base_unit', label: 'الوحدة' }, { key: 'unit_cost', label: 'تكلفة الوحدة', kind: 'money' }, { key: 'total_cost', label: 'إجمالي التكلفة', kind: 'money' },
  ],
}

const totalLabels: Record<string, string> = {
  order_count: 'عدد الطلبات', gross_sales: 'إجمالي المبيعات', discounts: 'الخصومات', paid: 'المدفوع', refunds: 'المرتجعات', net_collected: 'صافي التحصيل', invoice_count: 'عدد الفواتير', total: 'الإجمالي', net: 'الصافي', payment_count: 'عدد الدفعات', amount: 'القيمة', quantity: 'الكمية', distinct_products: 'عدد المنتجات', event_count: 'عدد الحركات', shift_count: 'عدد الورديات', payments_total: 'إجمالي التحصيل', refunds_total: 'إجمالي المرتجعات', cash_difference: 'إجمالي فرق النقدية', purchase_count: 'عدد أوامر الشراء', received_value: 'قيمة المستلم', ordered_quantity: 'الكمية المطلوبة', received_quantity: 'الكمية المستلمة', item_rows: 'عدد أرصدة الأصناف', balance: 'إجمالي الرصيد', inbound: 'الوارد', outbound: 'الصادر', low_stock_count: 'أصناف تحت الحد الأدنى', line_count: 'عدد بنود الهالك', receipt_line_count: 'عدد بنود الاستلام', total_cost: 'إجمالي تكلفة الشراء', weighted_avg_cost: 'متوسط التكلفة المرجح',
}

function monthStart() { const date = new Date(); date.setDate(1); return date.toISOString().slice(0, 10) }
function today() { return new Date().toISOString().slice(0, 10) }
const initialFilters: ReportFilters = { fromDate: monthStart(), toDate: today(), paymentMethod: '', employeeId: '', productId: '', orderType: '' }

function isSalesOperationsReport(key: ReportKey): key is SalesOperationsReportKey { return ['sales', 'invoices', 'payments', 'employees', 'products', 'returns', 'cashiers'].includes(key) }
function isProcurementInventoryReport(key: ReportKey): key is ProcurementInventoryReportKey { return ['purchases', 'inventory', 'waste'].includes(key) }
function isOperationalReport(key: ReportKey) { return isSalesOperationsReport(key) || isProcurementInventoryReport(key) || key === 'costs' }

function filterLabel(value: string) {
  const labels: Record<string, string> = { cash: 'كاش', card: 'بطاقة', dine_in: 'صالة', take_away: 'تيك أواي', drive_thru: 'درايف ثرو', delivery: 'دليفري', quick: 'سريع' }
  return labels[value] ?? value
}

export function ReportsPage() {
  const { currentBranchId, currentBranch } = useBranch()
  const { can } = usePermissions()
  const [selectedReport, setSelectedReport] = useState<ReportKey>('sales')
  const [filters, setFilters] = useState<ReportFilters>(initialFilters)
  const [options, setOptions] = useState<ReportFilterOptions>({ products: [], employees: [], payment_methods: ['cash', 'card'], order_types: ['dine_in', 'take_away', 'drive_thru', 'delivery', 'quick'] })
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ReportData | null>(null)
  const canView = can('reports.view')
  const selected = useMemo(() => reports.find((report) => report.key === selectedReport) ?? reports[0], [selectedReport])
  const columns = useMemo(() => columnsByReport[selectedReport] ?? [], [selectedReport])

  useEffect(() => {
    if (!currentBranchId || !canView) return
    setOptionsLoading(true); setError(null)
    void getReportFilterOptions(currentBranchId).then(setOptions).catch((cause) => setError(cause instanceof Error ? cause.message : 'تعذر تحميل خيارات التقارير')).finally(() => setOptionsLoading(false))
  }, [currentBranchId, canView])

  useEffect(() => {
    if (!currentBranchId || !canView || !isOperationalReport(selectedReport)) { setData(null); return }
    if (!filters.fromDate || !filters.toDate || filters.fromDate > filters.toDate) { setData(null); setError('نطاق التاريخ غير صالح'); return }
    setReportLoading(true); setError(null)
    const request = isSalesOperationsReport(selectedReport)
      ? getSalesOperationsReport(currentBranchId, selectedReport, filters)
      : isProcurementInventoryReport(selectedReport)
        ? getProcurementInventoryReport(currentBranchId, selectedReport, filters)
        : getPurchaseCostHistoryReport(currentBranchId, filters)
    void request.then(setData).catch((cause) => setError(cause instanceof Error ? cause.message : 'تعذر تحميل بيانات التقرير')).finally(() => setReportLoading(false))
  }, [currentBranchId, canView, selectedReport, filters])

  if (!currentBranchId || !canView) return null
  const setFilter = <K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) => setFilters((current) => ({ ...current, [key]: value }))

  return (
    <section className="workspace-card reports-workspace" aria-labelledby="reports-title">
      <div className="workspace-heading"><div><p className="eyebrow">Reports</p><h2 id="reports-title">مركز التقارير</h2><p>صفحة واحدة بدون رسوم بيانية؛ فلاتر موحدة، أعمدة مخصصة، إجماليات وتصدير Excel من نفس النتيجة.</p></div><span>{currentBranch?.name_ar ?? 'الفرع الحالي'}</span></div>
      <div className="reports-filter-bar">
        <label>من<input type="date" value={filters.fromDate} onChange={(event) => setFilter('fromDate', event.target.value)} /></label>
        <label>إلى<input type="date" value={filters.toDate} onChange={(event) => setFilter('toDate', event.target.value)} /></label>
        <label>طريقة الدفع<select value={filters.paymentMethod} onChange={(event) => setFilter('paymentMethod', event.target.value as ReportFilters['paymentMethod'])}><option value="">الكل</option>{options.payment_methods.map((method) => <option key={method} value={method}>{filterLabel(method)}</option>)}</select></label>
        <label>الموظف<select value={filters.employeeId} onChange={(event) => setFilter('employeeId', event.target.value)}><option value="">الكل</option>{options.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.display_name}</option>)}</select></label>
        <label>المنتج<select value={filters.productId} onChange={(event) => setFilter('productId', event.target.value)}><option value="">الكل</option>{options.products.map((product) => <option key={product.id} value={product.id}>{product.name_ar}{product.sku ? ` — ${product.sku}` : ''}</option>)}</select></label>
        <label>نوع الطلب<select value={filters.orderType} onChange={(event) => setFilter('orderType', event.target.value as ReportFilters['orderType'])}><option value="">الكل</option>{options.order_types.map((type) => <option key={type} value={type}>{filterLabel(type)}</option>)}</select></label>
        <button type="button" onClick={() => setFilters(initialFilters)}>إعادة الضبط</button>
      </div>
      {optionsLoading ? <p>جارٍ تحميل خيارات الفلاتر…</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      <div className="reports-layout">
        <aside className="report-selector" aria-label="أنواع التقارير">{reports.map((report) => <button key={report.key} type="button" className={selectedReport === report.key ? 'active' : ''} onClick={() => setSelectedReport(report.key)}><strong>{report.title}</strong><small>{report.description}</small></button>)}</aside>
        <div className="report-result-card">
          <div className="report-result-heading"><div><h3>{selected.title}</h3><p>{selected.description}</p></div><span>العقد: Batch {selected.batch}</span></div>
          <div className="report-filter-summary" aria-label="الفلاتر المطبقة"><span>{filters.fromDate} ← {filters.toDate}</span>{filters.paymentMethod ? <span>الدفع: {filterLabel(filters.paymentMethod)}</span> : null}{filters.employeeId ? <span>موظف محدد</span> : null}{filters.productId ? <span>منتج محدد</span> : null}{filters.orderType ? <span>نوع الطلب: {filterLabel(filters.orderType)}</span> : null}</div>
          {selectedReport === 'accounting' ? <AccountingReportsPanel branchId={currentBranchId} fromDate={filters.fromDate} toDate={filters.toDate} /> : null}
          {isOperationalReport(selectedReport) ? <OperationalReportResult reportKey={selectedReport} reportTitle={selected.title} fromDate={filters.fromDate} toDate={filters.toDate} columns={columns} totalLabels={totalLabels} data={data} loading={reportLoading} /> : null}
        </div>
      </div>
    </section>
  )
}
