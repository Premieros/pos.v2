import { useEffect, useMemo, useState } from 'react'
import { useBranch } from '../branches/useBranch'
import { usePermissions } from '../permissions/usePermissions'
import { getReportFilterOptions, type ReportFilterOptions, type ReportFilters } from './report.service'
import './reports.css'

type ReportKey = 'sales' | 'invoices' | 'payments' | 'employees' | 'products' | 'returns' | 'purchases' | 'inventory' | 'waste' | 'accounting'

const reports: Array<{ key: ReportKey; title: string; description: string; batch: string }> = [
  { key: 'sales', title: 'ملخص المبيعات', description: 'إجماليات البيع حسب الفترة والفلاتر.', batch: '8.2' },
  { key: 'invoices', title: 'الفواتير التفصيلية', description: 'كل فاتورة وبنودها وحالتها ومدفوعاتها.', batch: '8.2' },
  { key: 'payments', title: 'المبيعات حسب طريقة الدفع', description: 'كاش / بطاقة مع الإجماليات.', batch: '8.2' },
  { key: 'employees', title: 'المبيعات حسب الموظف', description: 'أداء المبيعات والتحصيل حسب الموظف.', batch: '8.2' },
  { key: 'products', title: 'المبيعات حسب المنتج', description: 'الكميات والقيم لكل منتج.', batch: '8.2' },
  { key: 'returns', title: 'المرتجعات والخصومات والإلغاءات', description: 'حركات التحكم التشغيلي وأثرها المالي.', batch: '8.2' },
  { key: 'purchases', title: 'المشتريات والموردون', description: 'أوامر واستلامات وتكلفة شراء.', batch: '8.3' },
  { key: 'inventory', title: 'المخزون والحركات', description: 'أرصدة وحركات وجرد وتنبيهات.', batch: '8.3' },
  { key: 'waste', title: 'الهالك', description: 'مستندات الهالك وتأثير المخزون.', batch: '8.3' },
  { key: 'accounting', title: 'التقارير المحاسبية', description: 'ميزان المراجعة ودفتر الأستاذ والقوائم المالية.', batch: '8.4' },
]

function monthStart() {
  const date = new Date()
  date.setDate(1)
  return date.toISOString().slice(0, 10)
}

function today() { return new Date().toISOString().slice(0, 10) }

const initialFilters: ReportFilters = {
  fromDate: monthStart(),
  toDate: today(),
  paymentMethod: '',
  employeeId: '',
  productId: '',
  orderType: '',
}

export function ReportsPage() {
  const { currentBranchId, currentBranch } = useBranch()
  const { can } = usePermissions()
  const [selectedReport, setSelectedReport] = useState<ReportKey>('sales')
  const [filters, setFilters] = useState<ReportFilters>(initialFilters)
  const [options, setOptions] = useState<ReportFilterOptions>({ products: [], employees: [], payment_methods: ['cash', 'card'], order_types: ['dine_in', 'take_away', 'drive_thru', 'delivery', 'quick'] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canView = can('reports.view')
  const selected = useMemo(() => reports.find((report) => report.key === selectedReport) ?? reports[0], [selectedReport])

  useEffect(() => {
    if (!currentBranchId || !canView) return
    setLoading(true)
    setError(null)
    void getReportFilterOptions(currentBranchId)
      .then(setOptions)
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'تعذر تحميل خيارات التقارير'))
      .finally(() => setLoading(false))
  }, [currentBranchId, canView])

  if (!currentBranchId || !canView) return null

  const setFilter = <K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) => setFilters((current) => ({ ...current, [key]: value }))

  return (
    <section className="workspace-card reports-workspace" aria-labelledby="reports-title">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">Reports</p>
          <h2 id="reports-title">مركز التقارير</h2>
          <p>صفحة واحدة بدون رسوم بيانية؛ فلاتر موحدة، جداول واضحة وإجماليات قابلة للتصدير والطباعة في المراحل التالية.</p>
        </div>
        <span>{currentBranch?.name_ar ?? 'الفرع الحالي'}</span>
      </div>

      <div className="reports-filter-bar">
        <label>من<input type="date" value={filters.fromDate} onChange={(event) => setFilter('fromDate', event.target.value)} /></label>
        <label>إلى<input type="date" value={filters.toDate} onChange={(event) => setFilter('toDate', event.target.value)} /></label>
        <label>طريقة الدفع<select value={filters.paymentMethod} onChange={(event) => setFilter('paymentMethod', event.target.value as ReportFilters['paymentMethod'])}><option value="">الكل</option>{options.payment_methods.map((method) => <option key={method} value={method}>{method === 'cash' ? 'كاش' : 'بطاقة'}</option>)}</select></label>
        <label>الموظف<select value={filters.employeeId} onChange={(event) => setFilter('employeeId', event.target.value)}><option value="">الكل</option>{options.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.display_name}</option>)}</select></label>
        <label>المنتج<select value={filters.productId} onChange={(event) => setFilter('productId', event.target.value)}><option value="">الكل</option>{options.products.map((product) => <option key={product.id} value={product.id}>{product.name_ar}{product.sku ? ` — ${product.sku}` : ''}</option>)}</select></label>
        <label>نوع الطلب<select value={filters.orderType} onChange={(event) => setFilter('orderType', event.target.value as ReportFilters['orderType'])}><option value="">الكل</option><option value="dine_in">صالة</option><option value="take_away">تيك أواي</option><option value="drive_thru">درايف ثرو</option><option value="delivery">دليفري</option><option value="quick">سريع</option></select></label>
        <button type="button" onClick={() => setFilters(initialFilters)}>إعادة الضبط</button>
      </div>

      {loading ? <p>جارٍ تحميل خيارات الفلاتر…</p> : null}
      {error ? <p className="error-text">{error}</p> : null}

      <div className="reports-layout">
        <aside className="report-selector" aria-label="أنواع التقارير">
          {reports.map((report) => (
            <button key={report.key} type="button" className={selectedReport === report.key ? 'active' : ''} onClick={() => setSelectedReport(report.key)}>
              <strong>{report.title}</strong>
              <small>{report.description}</small>
            </button>
          ))}
        </aside>

        <div className="report-result-card">
          <div className="report-result-heading">
            <div><h3>{selected.title}</h3><p>{selected.description}</p></div>
            <span>العقد: Batch {selected.batch}</span>
          </div>

          <div className="report-filter-summary" aria-label="الفلاتر المطبقة">
            <span>{filters.fromDate} ← {filters.toDate}</span>
            {filters.paymentMethod ? <span>الدفع: {filters.paymentMethod}</span> : null}
            {filters.employeeId ? <span>موظف محدد</span> : null}
            {filters.productId ? <span>منتج محدد</span> : null}
            {filters.orderType ? <span>نوع الطلب: {filters.orderType}</span> : null}
          </div>

          <div className="report-contract-placeholder">
            <strong>الهيكل الموحد جاهز.</strong>
            <p>تم تثبيت صلاحية التقارير، عزل الفرع، وخيارات الفلاتر الحقيقية من قاعدة البيانات. بيانات التقرير نفسها ستُوصل بعقود Read-only في 8.2–8.4 بدل عرض بيانات وهمية.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
