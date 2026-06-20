import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Call ready() immediately before React mounts so Telegram removes the loading overlay
if (window.Telegram?.WebApp) {
  window.Telegram.WebApp.ready()
  window.Telegram.WebApp.expand()
}

createRoot(document.getElementById('root')!).render(<App />)
