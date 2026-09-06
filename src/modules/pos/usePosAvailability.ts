import { useEffect, useMemo, useState } from 'react'
import { listPosProductAvailability, type PosProductAvailability } from './pos.service'

export function usePosAvailability(branchId: string | null, warehouseId: string) {
  const [rows, setRows] = useState<PosProductAvailability[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    if (!branchId || !warehouseId) {
      setRows([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      setRows(await listPosProductAvailability(branchId, warehouseId))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل توافر المنتجات')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [branchId, warehouseId])

  const byProductId = useMemo(() => new Map(rows.map((row) => [row.product_id, row])), [rows])
  return { byProductId, rows, loading, error, refresh }
}
