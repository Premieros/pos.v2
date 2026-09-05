import { useContext } from 'react'
import { PermissionContext } from './PermissionProvider'

export function usePermissions() {
  const context = useContext(PermissionContext)
  if (!context) throw new Error('usePermissions must be used inside PermissionProvider')
  return context
}
