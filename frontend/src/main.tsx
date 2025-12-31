import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { CriticalPathPageWrapper } from './pages/CriticalPathPageWrapper.tsx'
import { DropboxCallback } from './components/DropboxCallback.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/critical-path" element={<CriticalPathPageWrapper />} />
        <Route path="/dropbox-callback" element={<DropboxCallback />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
