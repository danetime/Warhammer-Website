import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './old-world-league.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
