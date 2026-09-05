import { supabase } from '../../lib/supabase/client'
import { listKitchenTickets, type KitchenTicket } from '../kitchen/kitchen.service'
import { getSalesOperationsReport, type ReportData, type ReportFilters } from '../reports/report.service'
import { listShifts, type Shift } from '../shifts/shift.service'

export type PrintableOrder = {
  id: string
  order_number: number
  order_type: string
  status: string
  total: number
  created_at: string
}

export async function listPrintableOrders(branchId: string): Promise<PrintableOrder[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('id,order_number,order_type,status,total,created_at')
    .eq('branch_id', branchId)
    .in('status', ['paid', 'closed'])
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return (data ?? []).map((row) => ({ ...row, total: Number(row.total) })) as PrintableOrder[]
}

export async function listPrintableKitchenTickets(branchId: string): Promise<KitchenTicket[]> {
  return listKitchenTickets(branchId)
}

export async function listPrintableShifts(branchId: string): Promise<Shift[]> {
  return listShifts(branchId)
}

export async function getDaySummary(branchId: string, date: string): Promise<ReportData> {
  const filters: ReportFilters = {
    fromDate: date,
    toDate: date,
    paymentMethod: '',
    employeeId: '',
    productId: '',
    orderType: '',
  }
  return getSalesOperationsReport(branchId, 'sales', filters)
}
