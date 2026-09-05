import { supabase } from '../../lib/supabase/client'

export type KitchenTicketStatus = 'queued' | 'preparing' | 'ready' | 'completed' | 'cancelled'

export type KitchenTicketItem = {
  id: string
  kitchen_ticket_id: string
  product_name: string
  quantity_delta: number
}

export type KitchenTicket = {
  id: string
  order_id: string
  sequence_no: number
  status: KitchenTicketStatus
  warehouse_id: string
  created_at: string
  started_at: string | null
  ready_at: string | null
  completed_at: string | null
  order_number: number | null
  order_type: string | null
  items: KitchenTicketItem[]
}

export async function listKitchenTickets(branchId: string): Promise<KitchenTicket[]> {
  const { data: tickets, error: ticketError } = await supabase
    .from('kitchen_tickets')
    .select('id, order_id, sequence_no, status, warehouse_id, created_at, started_at, ready_at, completed_at')
    .eq('branch_id', branchId)
    .in('status', ['queued', 'preparing', 'ready'])
    .order('created_at', { ascending: true })

  if (ticketError) throw ticketError
  if (!tickets?.length) return []

  const orderIds = [...new Set(tickets.map((ticket) => ticket.order_id))]
  const ticketIds = tickets.map((ticket) => ticket.id)

  const [{ data: orders, error: orderError }, { data: items, error: itemError }] = await Promise.all([
    supabase.from('orders').select('id, order_number, order_type').in('id', orderIds),
    supabase.from('kitchen_ticket_items').select('id, kitchen_ticket_id, product_name, quantity_delta').in('kitchen_ticket_id', ticketIds).order('created_at'),
  ])

  if (orderError) throw orderError
  if (itemError) throw itemError

  const orderById = new Map((orders ?? []).map((order) => [order.id, order]))
  const itemsByTicket = new Map<string, KitchenTicketItem[]>()

  for (const item of (items ?? []) as KitchenTicketItem[]) {
    const current = itemsByTicket.get(item.kitchen_ticket_id) ?? []
    current.push(item)
    itemsByTicket.set(item.kitchen_ticket_id, current)
  }

  return tickets.map((ticket) => {
    const order = orderById.get(ticket.order_id)
    return {
      ...ticket,
      order_number: order?.order_number ?? null,
      order_type: order?.order_type ?? null,
      items: itemsByTicket.get(ticket.id) ?? [],
    } as KitchenTicket
  })
}

export async function updateKitchenTicketStatus(ticketId: string, status: Exclude<KitchenTicketStatus, 'queued' | 'cancelled'>): Promise<void> {
  const { error } = await supabase.rpc('update_kitchen_ticket_status', {
    p_ticket_id: ticketId,
    p_status: status,
  })
  if (error) throw error
}
