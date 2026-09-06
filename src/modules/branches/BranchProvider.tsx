import { createContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { useAuth } from '../auth/useAuth'
import { listAccessibleBranches, type AccessibleBranch } from './branch.service'

const STORAGE_KEY = 'pos.v2.currentBranchId'

export type BranchContextValue = {
  branches: AccessibleBranch[]
  currentBranch: AccessibleBranch | null
  currentBranchId: string | null
  loading: boolean
  error: string | null
  setCurrentBranchId: (branchId: string) => void
  refreshBranches: () => Promise<void>
}

export const BranchContext = createContext<BranchContextValue | null>(null)

export function BranchProvider({ children }: PropsWithChildren) {
  const { user, loading: authLoading } = useAuth()
  const [branches, setBranches] = useState<AccessibleBranch[]>([])
  const [currentBranchId, setCurrentBranchIdState] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refreshBranches() {
    if (!user) {
      setBranches([])
      setCurrentBranchIdState(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const nextBranches = await listAccessibleBranches()
      setBranches(nextBranches)

      const stored = localStorage.getItem(STORAGE_KEY)
      const nextCurrent = nextBranches.some((branch) => branch.id === stored)
        ? stored
        : nextBranches[0]?.id ?? null

      setCurrentBranchIdState(nextCurrent)
      if (nextCurrent) localStorage.setItem(STORAGE_KEY, nextCurrent)
      else localStorage.removeItem(STORAGE_KEY)
    } catch (cause) {
      setBranches([])
      setCurrentBranchIdState(null)
      setError(cause instanceof Error ? cause.message : 'Failed to load branches')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading) void refreshBranches()
  }, [authLoading, user?.id])

  function setCurrentBranchId(branchId: string) {
    if (!branches.some((branch) => branch.id === branchId)) {
      throw new Error('Cannot select a branch outside the authenticated access scope')
    }
    localStorage.setItem(STORAGE_KEY, branchId)
    setCurrentBranchIdState(branchId)
  }

  const currentBranch = branches.find((branch) => branch.id === currentBranchId) ?? null

  const value = useMemo<BranchContextValue>(
    () => ({
      branches,
      currentBranch,
      currentBranchId,
      loading: authLoading || loading,
      error,
      setCurrentBranchId,
      refreshBranches,
    }),
    [branches, currentBranch, currentBranchId, authLoading, loading, error],
  )

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>
}
