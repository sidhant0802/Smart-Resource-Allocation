import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth, ROLE_PATHS } from '../../context/AuthContext'
import { authApi } from '../../api/authApi'

const ROLE_INFO = {
  super_admin:      { label: 'Super Admin',     icon: '👑' },
  ngo_manager:      { label: 'NGO Manager',      icon: '🏢' },
  committee_member: { label: 'Committee Member', icon: '👥' },
  ngo_staff:        { label: 'NGO Staff',        icon: '📋' },
  volunteer:        { label: 'Volunteer',         icon: '🙋' },
}

export default function Login() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { login } = useAuth()

  const fromMessage = location.state?.message

  const [form, setForm]               = useState({ email: '', password: '' })
  const [errors, setErrors]           = useState({})
  const [loading, setLoading]         = useState(false)
  const [successRole, setSuccessRole] = useState(null)
  const [showPassword, setShowPassword] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    setErrors(prev => ({ ...prev, [name]: '', submit: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!form.email.trim())    errs.email    = 'Email is required'
    if (!form.password.trim()) errs.password = 'Password is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    try {
      const res = await authApi.login({
        email:    form.email.trim(),
        password: form.password,
      })

      setSuccessRole(res.user.role)
      login(res.user, res.token)

      setTimeout(() => {
        navigate(ROLE_PATHS[res.user.role] || '/')
      }, 1500)

    } catch (err) {
      const msg = err.message
      if (msg === 'PENDING') {
        setErrors({
          submit: '⏳ Your account is pending approval. You will be notified once approved.',
        })
      } else if (msg === 'SUSPENDED') {
        setErrors({ submit: '🚫 Account suspended. Contact support.' })
      } else if (msg === 'INACTIVE') {
        setErrors({ submit: '⚠️ Account is inactive.' })
      } else {
        setErrors({ submit: msg || 'Invalid email or password' })
      }
    } finally {
      setLoading(false)
    }
  }

  // Success screen
  if (successRole) {
    const info = ROLE_INFO[successRole]
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50
                      to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-10
                        max-w-sm w-full mx-4 text-center">
          <div className="text-7xl mb-4 animate-bounce">{info.icon}</div>
          <h2 className="text-2xl font-bold text-gray-800">
            Welcome Back!
          </h2>
          <div className="mt-2 inline-block bg-blue-100 text-blue-700
                          px-4 py-1 rounded-full text-sm font-medium">
            {info.label}
          </div>
          <p className="text-gray-400 text-sm mt-4">
            Taking you to your dashboard...
          </p>
          <div className="mt-4 flex justify-center">
            <div className="animate-spin h-6 w-6 border-2
                            border-blue-500 border-t-transparent
                            rounded-full"/>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50
                    via-white to-indigo-50 flex items-center
                    justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full
                      max-w-md overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600
                        p-8 text-center text-white">
          <div className="text-5xl mb-3">🌍</div>
          <h1 className="text-2xl font-bold">Welcome Back</h1>
          <p className="text-blue-100 text-sm mt-1">
            Smart Resource Allocation Platform
          </p>
        </div>

        <div className="p-8">

          {/* Success message from signup */}
          {fromMessage && (
            <div className="mb-5 bg-green-50 border border-green-200
                            rounded-xl p-4 flex gap-2 items-start">
              <span className="text-green-500">✅</span>
              <p className="text-sm text-green-700">{fromMessage}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email */}
            <div>
              <label className="block text-sm font-medium
                                text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="your@email.com"
                autoComplete="email"
                className={`w-full px-4 py-3 border rounded-xl text-sm
                            focus:outline-none focus:ring-2
                            focus:ring-blue-500 transition-colors
                  ${errors.email
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-200'
                  }`}
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">{errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-sm font-medium text-gray-700">
                  Password
                </label>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Your password"
                  autoComplete="current-password"
                  className={`w-full px-4 py-3 pr-12 border rounded-xl
                              text-sm focus:outline-none
                              focus:ring-2 focus:ring-blue-500
                    ${errors.password
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-200'
                    }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2
                             text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.password}
                </p>
              )}
            </div>

            {/* Submit Error */}
            {errors.submit && (
              <div className="bg-red-50 border border-red-200
                              rounded-xl p-4 text-sm text-red-700">
                {errors.submit}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-blue-600
                         to-indigo-600 text-white rounded-xl font-semibold
                         hover:from-blue-700 hover:to-indigo-700
                         disabled:opacity-60 transition-all
                         flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2
                                  border-white border-t-transparent
                                  rounded-full"/>
                  Logging in...
                </>
              ) : (
                'Login to Dashboard →'
              )}
            </button>
          </form>

          {/* Role pills */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center mb-3">
              Platform Roles
            </p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(ROLE_INFO).map(([key, val]) => (
                <div key={key}
                     className="flex items-center gap-2 bg-gray-50
                                rounded-lg px-3 py-2 text-xs
                                text-gray-600">
                  <span>{val.icon}</span>
                  <span>{val.label}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-center text-sm text-gray-500 mt-5">
            New here?{' '}
            <Link to="/signup"
                  className="text-blue-600 font-medium hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}