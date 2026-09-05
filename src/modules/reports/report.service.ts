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
