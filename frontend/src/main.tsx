import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { useAuthStore } from './shared/store/auth.store'
import { useUIStore } from './shared/store/ui.store'

// Восстанавливаем auth и UI из localStorage до первого рендера,
// иначе ProtectedRoute редиректит на /login до загрузки токена
useAuthStore.getState().loadFromStorage()
useUIStore.getState().loadFromStorage()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
