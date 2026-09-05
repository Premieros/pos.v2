import { createContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { useAuth } from '../auth/useAuth'
import { useBranch } from '../branches/useBranch'
import { getEffectivePermissions } from './permission.service'

export type PermissionContextValue = {
  permissions: ReadonlySet<string>
  loading: boolean
  error: string | null
  can: (permissionKey: string) => boolean
  refreshPermissions: () => Promise<void>
}

export const PermissionContext = createContext<PermissionContextValue | null>(null)

export function PermissionProvider({ children }: PropsWithChildren) {
  const { user, loading: authLoading } = useAuth()
  const { currentBranchId, loading: branchLoading } = useBranch()
  const [permissions, setPermissions] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refreshPermissions() {
    if (!user || !currentBranchId) {
      setPermissions(new Set())
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      setPermissions(await getEffectivePermissions(currentBranchId))
    } catch (cause) {
      setPermissions(new Set())
      setError(cause instanceof Error ? cause.message : 'Failed to load permissions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading && !branchLoading) void refreshPermissions()
  }, [authLoading, branchLoading, user?.id, currentBranchId])

  const value = useMemo<PermissionContextValue>(
    () => ({
      permissions,
      loading: authLoading || branchLoading || loading,
      error,
      can: (permissionKey: string) => permissions.has(permissionKey),
      refreshPermissions,
    }),
    [permissions, authLoading, branchLoading, loading, error],
  )

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>
}
