import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Chat from './pages/Chat'
import Goals from './pages/Goals'
import Alerts from './pages/Alerts'
import Rebalancing from './pages/Rebalancing'
import Scenarios from './pages/Scenarios'
import { useAuth } from './hooks/useAuth'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-slate-400 text-sm">
        <span className="live-dot mr-3" /> Loading your portfolio…
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return children
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/dashboard/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
        <Route path="/dashboard/goals" element={<ProtectedRoute><Goals /></ProtectedRoute>} />
        <Route path="/dashboard/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
        <Route path="/dashboard/rebalance" element={<ProtectedRoute><Rebalancing /></ProtectedRoute>} />
        <Route path="/dashboard/scenarios" element={<ProtectedRoute><Scenarios /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
