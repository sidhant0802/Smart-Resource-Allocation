import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react'
import { authApi } from '../api/authApi'

// ✅ Must be exported with 'export const'
export const ROLE_PATHS = {
  super_admin: '/dashboard/super-admin',
  ngo_manager: '/dashboard/ngo-manager',
  committee_member: '/dashboard/committee',
  ngo_staff: '/dashboard/staff',
  volunteer: '/dashboard/volunteer',
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const restoreSession = async () => {
      const token = localStorage.getItem('token')
      const userData = localStorage.getItem('user')

      if (token && userData) {
        try {
          const res = await authApi.getMe()
          setUser(res.user)
          localStorage.setItem('user', JSON.stringify(res.user))
        } catch (err) {
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          setUser(null)
        }
      }

      setLoading(false)
    }

    restoreSession()
  }, [])

  const login = useCallback((userData, token) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }, [])

  const updateUser = useCallback((updatedData) => {
    setUser(prev => {
      if (!prev) return prev
      const newUser = {
        ...prev,
        ...updatedData,
        role: updatedData.role || prev.role,
        status: updatedData.status || prev.status,
      }
      localStorage.setItem('user', JSON.stringify(newUser))
      return newUser
    })
  }, [])

  const getDashboardPath = useCallback(() => {
    if (!user) return '/login'
    return ROLE_PATHS[user.role] || ROLE_PATHS[user.roleName] || '/login'
  }, [user])

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      updateUser,
      getDashboardPath,
      isAuthenticated: !!user,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}

export default AuthContext