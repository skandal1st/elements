import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { useUIStore } from './shared/store/ui.store'

// Инициализируем UI настройки из localStorage
useUIStore.getState().loadFromStorage()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
