import { closeShift, type Shift } from './shift.service'

const STORAGE_KEY = 'pos.v2.pending-shift-closes.v1'

export type PendingShiftClose = {
  idempotencyKey: string
  userId: string
  branchId: string
  shiftId: string
  actualCash: number
  note: string
  createdAt: string
  lastError: string | null
}

function readAll(): PendingShiftClose[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed as PendingShiftClose[] : []
  } catch {
    return []
  }
}

function writeAll(items: PendingShiftClose[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export function listPendingShiftCloses(userId: string, branchId: string): PendingShiftClose[] {
  return readAll().filter((item) => item.userId === userId && item.branchId === branchId)
}

export function queueShiftClose(input: Omit<PendingShiftClose, 'createdAt' | 'lastError'>): PendingShiftClose {
  const all = readAll()
  const existing = all.find((item) => item.idempotencyKey === input.idempotencyKey)
  if (existing) return existing
  const next: PendingShiftClose = { ...input, createdAt: new Date().toISOString(), lastError: null }
  writeAll([...all, next])
  return next
}

export function removePendingShiftClose(idempotencyKey: string) {
  writeAll(readAll().filter((item) => item.idempotencyKey !== idempotencyKey))
}

function updatePendingError(idempotencyKey: string, message: string) {
  writeAll(readAll().map((item) => item.idempotencyKey === idempotencyKey ? { ...item, lastError: message } : item))
}

export async function syncPendingShiftClose(item: PendingShiftClose): Promise<Shift> {
  try {
    const result = await closeShift({
      shiftId: item.shiftId,
      branchId: item.branchId,
      actualCash: item.actualCash,
      note: item.note,
      idempotencyKey: item.idempotencyKey,
    })
    removePendingShiftClose(item.idempotencyKey)
    return result
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'تعذر مزامنة إغلاق الوردية'
    updatePendingError(item.idempotencyKey, message)
    throw cause
  }
}

export async function syncPendingShiftCloses(userId: string, branchId: string): Promise<{ synced: number; failed: number }> {
  if (!navigator.onLine) return { synced: 0, failed: 0 }
  let synced = 0
  let failed = 0
  for (const item of listPendingShiftCloses(userId, branchId)) {
    try { await syncPendingShiftClose(item); synced += 1 }
    catch { failed += 1 }
  }
  return { synced, failed }
}
