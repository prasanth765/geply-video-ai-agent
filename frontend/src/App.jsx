import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './hooks/useAuth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import JobDetail from './pages/JobDetail'
import CandidateSchedule from './pages/CandidateSchedule'
import InterviewRoom from './pages/InterviewRoom'
import ReportView from './pages/ReportView'
import Profile from './pages/Profile'

// ✅ Password Reset Pages
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuthStore()
  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const loadUser = useAuthStore((s) => s.loadUser)
  useEffect(() => { 
    loadUser() 
  }, [loadUser])

  return (
    <Routes>
      {/* ── Public Authentication Routes ── */}
      <Route path="/login" element={<Login />} />
      
      {/* ── Password Reset Routes ── */}
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* ── Public Interview Routes (No Auth Needed) ── */}
      <Route path="/schedule/:token" element={<CandidateSchedule />} />
      <Route path="/interview/:token" element={<InterviewRoom />} />

      {/* ── Protected Recruiter Routes ── */}
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="jobs/:jobId" element={<JobDetail />} />
        <Route path="reports/:reportId" element={<ReportView />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      {/* ── Catch All / 404 ── */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}