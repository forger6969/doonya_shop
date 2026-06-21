import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './ErrorBoundary.tsx'
import { LangProvider } from './i18n.tsx'

if (window.Telegram?.WebApp) {
  window.Telegram.WebApp.ready()
  window.Telegram.WebApp.expand()
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <LangProvider>
      <App />
    </LangProvider>
  </ErrorBoundary>
)
