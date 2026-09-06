import { supabase } from '../../lib/supabase/client'

export type ReportProductOption = {
  id: string
  name_ar: string
  name_en: string | null
  sku: string | null
  is_active: boolean
}

export type ReportEmployeeOption = {
  id: string
  display_name: string
  is_active: boolean
}

export type ReportFilterOptions = {
  products: ReportProductOption[]
  employees: ReportEmployeeOption[]
  payment_methods: Array<'cash' | 'card'>
  order_types: Array<'dine_in' | 'take_away' | 'drive_thru' | 'delivery' | 'quick'>
}

export type ReportFilters = {
  fromDate: string
  toDate: string
  paymentMethod: '' | 'cash' | 'card'
  employeeId: string
  productId: string
  orderType: '' | 'dine_in' | 'take_away' | 'drive_thru' | 'delivery' | 'quick'
}

export type SalesOperationsReportKey = 'sales' | 'invoices' | 'payments' | 'employees' | 'products' | 'returns' | 'cashiers'
export type ProcurementInventoryReportKey = 'purchases' | 'inventory' | 'waste'
export type CostReportKey = 'costs'

export type ReportData = {
  report_key: SalesOperationsReportKey | ProcurementInventoryReportKey | CostReportKey
  rows: Array<Record<string, unknown>>
  totals: Record<string, unknown>
  generated_at: string
}

export async function getReportFilterOptions(branchId: string): Promise<ReportFilterOptions> {
  const { data, error } = await supabase.rpc('get_report_filter_options', { p_branch_id: branchId })
  if (error) throw error
  const value = (data ?? {}) as Partial<ReportFilterOptions>
  return {
    products: Array.isArray(value.products) ? value.products : [],
    employees: Array.isArray(value.employees) ? value.employees : [],
    payment_methods: Array.isArray(value.payment_methods) ? value.payment_methods : ['cash', 'card'],
    order_types: Array.isArray(value.order_types) ? value.order_types : ['dine_in', 'take_away', 'drive_thru', 'delivery', 'quick'],
  }
}

function normalizeReportData(data: unknown, reportKey: ReportData['report_key']): ReportData {
  const value = (data ?? {}) as Partial<ReportData>
  return {
    report_key: reportKey,
    rows: Array.isArray(value.rows) ? value.rows : [],
    totals: value.totals && typeof value.totals === 'object' ? value.totals : {},
    generated_at: typeof value.generated_at === 'string' ? value.generated_at : new Date().toISOString(),
  }
}

export async function getSalesOperationsReport(branchId: string, reportKey: SalesOperationsReportKey, filters: ReportFilters): Promise<ReportData> {
  const { data, error } = await supabase.rpc('get_sales_operations_report', {
    p_branch_id: branchId,
    p_report_key: reportKey,
    p_from_date: filters.fromDate,
    p_to_date: filters.toDate,
    p_payment_method: filters.paymentMethod || null,
    p_employee_id: filters.employeeId || null,
    p_product_id: filters.productId || null,
    p_order_type: filters.orderType || null,
  })
  if (error) throw error
  return normalizeReportData(data, reportKey)
}

export async function getProcurementInventoryReport(branchId: string, reportKey: ProcurementInventoryReportKey, filters: ReportFilters): Promise<ReportData> {
  const { data, error } = await supabase.rpc('get_procurement_inventory_report', {
    p_branch_id: branchId,
    p_report_key: reportKey,
    p_from_date: filters.fromDate,
    p_to_date: filters.toDate,
    p_product_id: filters.productId || null,
  })
  if (error) throw error
  return normalizeReportData(data, reportKey)
}

export async function getPurchaseCostHistoryReport(branchId: string, filters: ReportFilters): Promise<ReportData> {
  const { data, error } = await supabase.rpc('get_purchase_cost_history_report', {
    p_branch_id: branchId,
    p_from_date: filters.fromDate,
    p_to_date: filters.toDate,
    p_product_id: filters.productId || null,
  })
  if (error) throw error
  return normalizeReportData(data, 'costs')
}
