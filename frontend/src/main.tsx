import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { ProtectedRoute } from './components/ProtectedRoute.tsx'
import { LandingPage } from './pages/LandingPage.tsx'
import { LoginPage } from './pages/LoginPage.tsx'
import { RegisterPage } from './pages/RegisterPage.tsx'
import { CriticalPathPageWrapper } from './pages/CriticalPathPageWrapper.tsx'
import { DropboxCallback } from './components/DropboxCallback.tsx'
import { OneDriveCallback } from './components/OneDriveCallback.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* OAuth callbacks */}
          <Route path="/dropbox-callback" element={<DropboxCallback />} />
          <Route path="/onedrive-callback" element={<OneDriveCallback />} />

          {/* Protected routes */}
          <Route path="/app" element={
            <ProtectedRoute>
              <App />
            </ProtectedRoute>
          } />
          <Route path="/critical-path" element={
            <ProtectedRoute>
              <CriticalPathPageWrapper />
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
