import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth, ROLE_PATHS } from './context/AuthContext'
import ProtectedRoute from './components/shared/ProtectedRoute'

import Login  from './pages/auth/Login'
import Signup from './pages/auth/Signup'

import SuperAdminDashboard  from './pages/dashboards/SuperAdminDashboard'
import NgoManagerDashboard  from './pages/dashboards/NgoManagerDashboard'
import CommitteeDashboard   from './pages/dashboards/CommitteeDashboard'
import NgoStaffDashboard    from './pages/dashboards/NgoStaffDashboard'
import VolunteerDashboard   from './pages/dashboards/VolunteerDashboard'

function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) {
    return <Navigate to={ROLE_PATHS[user.role] || '/login'} replace />
  }
  return <Navigate to="/login" replace />
}

function AuthRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user && user.status === 'active') {
    return <Navigate to={ROLE_PATHS[user.role] || '/login'} replace />
  }
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />

      <Route path="/login" element={
        <AuthRoute><Login /></AuthRoute>
      }/>
      <Route path="/signup" element={
        <AuthRoute><Signup /></AuthRoute>
      }/>

      <Route path="/dashboard/super-admin" element={
        <ProtectedRoute allowedRole="super_admin">
          <SuperAdminDashboard />
        </ProtectedRoute>
      }/>

      <Route path="/dashboard/ngo-manager" element={
        <ProtectedRoute allowedRole="ngo_manager">
          <NgoManagerDashboard />
        </ProtectedRoute>
      }/>

      <Route path="/dashboard/committee" element={
        <ProtectedRoute allowedRole="committee_member">
          <CommitteeDashboard />
        </ProtectedRoute>
      }/>

      <Route path="/dashboard/staff" element={
        <ProtectedRoute allowedRole="ngo_staff">
          <NgoStaffDashboard />
        </ProtectedRoute>
      }/>

      <Route path="/dashboard/volunteer" element={
        <ProtectedRoute allowedRole="volunteer">
          <VolunteerDashboard />
        </ProtectedRoute>
      }/>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter future={{
      v7_startTransition:   true,
      v7_relativeSplatPath: true,
    }}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}