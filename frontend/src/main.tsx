import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './globals.css'

// Apply saved theme before first paint (avoids flash)
const saved = localStorage.getItem('pagehound-theme')
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
document.documentElement.classList.add(saved ?? (prefersDark ? 'dark' : 'light'))

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
