import { Navigate, useLocation } from 'react-router-dom'
import { useAuth, ROLE_PATHS } from '../../context/AuthContext'

export default function ProtectedRoute({ children, allowedRole }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  // While checking session
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center
                      justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12
                          border-b-2 border-blue-600 mx-auto"/>
          <p className="text-gray-500 mt-4 text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  // Not logged in
  if (!user) {
    return (
      <Navigate to="/login" state={{ from: location }} replace />
    )
  }

  // Wrong role → redirect to their own dashboard
  if (user.role !== allowedRole) {
    const correctPath = ROLE_PATHS[user.role] || '/login'
    return <Navigate to={correctPath} replace />
  }

  // Account not active
  if (user.status !== 'active') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center
                      justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8
                        max-w-md w-full text-center">
          <div className="text-6xl mb-4">⏳</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Account Pending Approval
          </h2>
          <p className="text-gray-500 text-sm">
            Your account is waiting for approval.
            You will be notified once approved.
          </p>
          <p className="mt-4 text-xs text-gray-400">
            Status:{' '}
            <span className="font-medium text-yellow-600">
              {user.status}
            </span>
          </p>
        </div>
      </div>
    )
  }

  return children
}