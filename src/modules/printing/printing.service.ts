import { supabase } from '../../lib/supabase/client'
import { listKitchenTickets, type KitchenTicket } from '../kitchen/kitchen.service'
import { getSalesOperationsReport, type ReportData, type ReportFilters } from '../reports/report.service'
import { listShifts, type Shift } from '../shifts/shift.service'

const DAY_CACHE_PREFIX = 'pos.v2.day-summary.v1'

export type PrintableOrder = {
  id: string
  order_number: number
  order_type: string
  status: string
  total: number
  created_at: string
}

export type CachedDaySummary = {
  branchId: string
  date: string
  cachedAt: string
  data: ReportData
}

function dayCacheKey(branchId: string, date: string) {
  return `${DAY_CACHE_PREFIX}:${branchId}:${date}`
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

export function getCachedDaySummary(branchId: string, date: string): CachedDaySummary | null {
  try {
    const raw = localStorage.getItem(dayCacheKey(branchId, date))
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedDaySummary
    if (parsed.branchId !== branchId || parsed.date !== date || !parsed.data) return null
    return parsed
  } catch {
    return null
  }
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
  const data = await getSalesOperationsReport(branchId, 'sales', filters)
  const cached: CachedDaySummary = { branchId, date, cachedAt: new Date().toISOString(), data }
  localStorage.setItem(dayCacheKey(branchId, date), JSON.stringify(cached))
  return data
}
