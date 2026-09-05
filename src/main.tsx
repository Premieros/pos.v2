import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { AuthProvider } from './modules/auth/AuthProvider'
import { BranchProvider } from './modules/branches/BranchProvider'
import { PermissionProvider } from './modules/permissions/PermissionProvider'
import './styles/global.css'
import './styles/shell.css'
import './styles/kitchen.css'
import './styles/payments.css'
import './styles/final-ui.css'

const root = document.getElementById('root')

if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <AuthProvider>
      <BranchProvider>
        <PermissionProvider>
          <App />
        </PermissionProvider>
      </BranchProvider>
    </AuthProvider>
  </StrictMode>,
)
