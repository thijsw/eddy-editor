import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../style.css'
import { App } from './app'

const el = document.getElementById('app')
if (!el) throw new Error('#app not found')
createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
