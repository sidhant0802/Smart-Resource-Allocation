import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import LocationPickerMap from '../../components/auth/LocationPickerMap'
import { authApi } from '../../api/authApi'

const ROLES = [
  {
    value:      'ngo_manager',
    label:      'NGO Manager',
    icon:       '🏢',
    desc:       'I run an NGO and want to manage operations on this platform',
    badge:      'NGO needs Super Admin approval',
    badgeColor: 'yellow',
    note:       'You can login immediately. Your NGO unlocks after approval.',
  },
  {
    value:      'committee_member',
    label:      'Committee Member',
    icon:       '👥',
    desc:       'I manage a specific zone for an NGO',
    badge:      'Free to join',
    badgeColor: 'blue',
    note:       'Login instantly. Zone assigned by NGO Manager.',
  },
  {
    value:      'ngo_staff',
    label:      'NGO Field Staff',
    icon:       '📋',
    desc:       'I collect and submit field reports for an NGO',
    badge:      'Free to join',
    badgeColor: 'green',
    note:       'Login instantly. Start reporting after zone assignment.',
  },
  {
    value:      'volunteer',
    label:      'Volunteer',
    icon:       '🙋',
    desc:       'I want to help with tasks near my location',
    badge:      'Completely free',
    badgeColor: 'green',
    note:       'Login and start applying for tasks immediately!',
  },
]

const SKILLS = [
  'Medical', 'Teaching', 'Driving', 'Cooking',
  'Construction', 'Counseling', 'Technology',
  'Logistics', 'Photography', 'Translation',
  'First Aid', 'Legal Aid',
]

const TASK_TYPES = [
  'Health', 'Food', 'Water', 'Education',
  'Shelter', 'Sanitation', 'Disaster Relief',
  'Infrastructure', 'Women Safety', 'Child Welfare',
]

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function Field({ label, error, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-gray-400 text-xs mt-1">{hint}</p>}
      {error && <p className="text-red-500 text-xs mt-1">⚠️ {error}</p>}
    </div>
  )
}

const ic = (hasError) =>
  `w-full px-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none transition-colors ${
    hasError ? 'border-red-300 bg-red-50' : 'border-gray-200 focus:border-blue-500'
  }`

export default function Signup() {
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [ngos, setNgos] = useState([])
  const [ngoLoading, setNgoLoading] = useState(false)

  const [form, setForm] = useState({
    role: '',
    fullName: '', email: '', password: '', confirmPassword: '', phone: '',
    latitude: null, longitude: null, locationName: '', operatingRadius: 10,
    ngoName: '', ngoDescription: '', ngoWebsite: '',
    ngoId: '',
    skills: [], taskPreferences: [], availableDays: [], availableTime: '',
  })

  const [errors, setErrors]     = useState({})
  const [loading, setLoading]   = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [showConfirmPass, setShowConfirmPass] = useState(false)

  useEffect(() => {
    if (form.role === 'committee_member' || form.role === 'ngo_staff') {
      setNgoLoading(true)
      authApi.getApprovedNgos()
        .then(res => setNgos(res.ngos || []))
        .catch(() => setNgos([]))
        .finally(() => setNgoLoading(false))
    }
  }, [form.role])

  const set = (name, value) => {
    setForm(prev => ({ ...prev, [name]: value }))
    setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const toggle = (field, value) => {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(v => v !== value)
        : [...prev[field], value],
    }))
  }

  const validateStep1 = () => {
    if (!form.role) { setErrors({ role: 'Please select your role' }); return false }
    return true
  }

  const validateStep2 = () => {
    const errs = {}
    if (!form.fullName.trim())          errs.fullName        = 'Full name is required'
    if (!form.email.trim())             errs.email           = 'Email is required'
    if (!/\S+@\S+\.\S+/.test(form.email)) errs.email        = 'Enter a valid email'
    if (form.password.length < 6)       errs.password        = 'Minimum 6 characters'
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match'
    if (!form.phone.trim())             errs.phone           = 'Phone number is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const validateStep3 = () => {
    const errs = {}
    if (!form.latitude || !form.longitude) errs.location = 'Please select your location'
    if (form.role === 'ngo_manager' && !form.ngoName.trim()) errs.ngoName = 'NGO name is required'
    if ((form.role === 'committee_member' || form.role === 'ngo_staff') && !form.ngoId)
      errs.ngoId = 'Please select your NGO'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleNext = () => {
    if (step === 1 && validateStep1()) setStep(2)
    if (step === 2 && validateStep2()) setStep(3)
  }

  const handleSubmit = async () => {
    if (!validateStep3()) return
    setLoading(true)
    try {
      await authApi.signup(form)
      navigate('/login', {
        state: {
          message: form.role === 'ngo_manager'
            ? '✅ Account created! You can login now. Your NGO is pending Super Admin approval.'
            : form.role === 'volunteer'
            ? '✅ Account created! Login and start applying for tasks!'
            : '✅ Account created! Login now. Your zone will be assigned by the NGO Manager.',
        },
      })
    } catch (err) {
      if (err.message.includes('EMAIL_EXISTS') || err.message.toLowerCase().includes('already exists')) {
        setErrors({ submit: '📧 This email is already registered. Please login instead.' })
      } else {
        setErrors({ submit: err.message })
      }
    } finally {
      setLoading(false)
    }
  }

  const selectedRole = ROLES.find(r => r.value === form.role)
  const progress = (step / 3) * 100
  const stepLabels = ['Choose Role', 'Your Details', 'Location & Setup']

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">🌍</div>
          <h1 className="text-2xl font-bold text-white">Join the Platform</h1>
          <p className="text-blue-300 text-sm mt-1">Smart Resource Allocation for Social Impact</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Progress bar */}
          <div className="h-1.5 bg-gray-100">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Step indicators */}
          <div className="flex border-b border-gray-100">
            {stepLabels.map((label, i) => (
              <div
                key={label}
                className={`flex-1 py-3 text-center text-xs font-medium transition-colors ${
                  i + 1 === step
                    ? 'text-blue-600 bg-blue-50'
                    : i + 1 < step
                    ? 'text-green-600 bg-green-50'
                    : 'text-gray-400'
                }`}
              >
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold mr-1.5 ${
                  i + 1 < step ? 'bg-green-500 text-white' :
                  i + 1 === step ? 'bg-blue-600 text-white' :
                  'bg-gray-200 text-gray-500'
                }`}>
                  {i + 1 < step ? '✓' : i + 1}
                </span>
                {label}
              </div>
            ))}
          </div>

          <div className="p-6">

            {/* ══ STEP 1: Role Selection ══ */}
            {step === 1 && (
              <div className="space-y-3">
                <div className="mb-4">
                  <h2 className="text-lg font-bold text-gray-800">Who are you?</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Select your role on the platform</p>
                </div>

                {ROLES.map(r => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => set('role', r.value)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      form.role === r.value
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-blue-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
                        form.role === r.value ? 'bg-blue-100' : 'bg-gray-100'
                      }`}>
                        {r.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-gray-800 text-sm">{r.label}</p>
                          {form.role === r.value && (
                            <span className="text-blue-500 text-lg">✓</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{r.desc}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                            r.badgeColor === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                            r.badgeColor === 'blue' ? 'bg-blue-100 text-blue-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {r.badge}
                          </span>
                        </div>
                        {form.role === r.value && (
                          <p className="text-xs text-blue-600 mt-2 font-medium">💡 {r.note}</p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}

                {errors.role && <p className="text-red-500 text-xs">⚠️ {errors.role}</p>}

                <button
                  onClick={handleNext}
                  className="w-full mt-2 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-200"
                >
                  Continue →
                </button>

                <p className="text-center text-sm text-gray-500">
                  Already have an account?{' '}
                  <Link to="/login" className="text-blue-600 font-bold hover:underline">Login</Link>
                </p>
              </div>
            )}

            {/* ══ STEP 2: Basic Info ══ */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  {selectedRole && (
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-xl">
                      {selectedRole.icon}
                    </div>
                  )}
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">Your Details</h2>
                    <p className="text-xs text-gray-500">Signing up as {selectedRole?.label}</p>
                  </div>
                </div>

                <Field label="Full Name *" error={errors.fullName}>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={e => set('fullName', e.target.value)}
                    placeholder="Enter your full name"
                    className={ic(errors.fullName)}
                  />
                </Field>

                <Field label="Email Address *" error={errors.email} hint="One account per email address">
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => set('email', e.target.value)}
                    placeholder="your@email.com"
                    className={ic(errors.email)}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Password *" error={errors.password}>
                    <div className="relative">
                      <input
                        type={showPass ? 'text' : 'password'}
                        value={form.password}
                        onChange={e => set('password', e.target.value)}
                        placeholder="Min 6 chars"
                        className={ic(errors.password) + ' pr-10'}
                      />
                      <button type="button" onClick={() => setShowPass(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                        {showPass ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </Field>

                  <Field label="Confirm Password *" error={errors.confirmPassword}>
                    <div className="relative">
                      <input
                        type={showConfirmPass ? 'text' : 'password'}
                        value={form.confirmPassword}
                        onChange={e => set('confirmPassword', e.target.value)}
                        placeholder="Repeat password"
                        className={ic(errors.confirmPassword) + ' pr-10'}
                      />
                      <button type="button" onClick={() => setShowConfirmPass(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                        {showConfirmPass ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </Field>
                </div>

                <Field label="Phone Number *" error={errors.phone}>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => set('phone', e.target.value)}
                    placeholder="+91 XXXXXXXXXX"
                    className={ic(errors.phone)}
                  />
                </Field>

                {/* Password strength */}
                {form.password && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500 mb-2">Password strength:</p>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className={`h-1.5 flex-1 rounded-full ${
                          form.password.length >= i * 3
                            ? i <= 1 ? 'bg-red-400'
                            : i <= 2 ? 'bg-yellow-400'
                            : i <= 3 ? 'bg-blue-400'
                            : 'bg-green-500'
                            : 'bg-gray-200'
                        }`} />
                      ))}
                    </div>
                    <p className="text-xs mt-1 text-gray-400">
                      {form.password.length < 6 ? 'Too short' :
                       form.password.length < 9 ? 'Weak' :
                       form.password.length < 12 ? 'Good' : 'Strong ✅'}
                    </p>
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button onClick={() => setStep(1)} className="flex-1 py-3 border-2 border-gray-200 rounded-xl text-gray-600 font-semibold hover:border-gray-300">← Back</button>
                  <button onClick={handleNext} className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700">Continue →</button>
                </div>
              </div>
            )}

            {/* ══ STEP 3: Details & Location ══ */}
            {step === 3 && (
              <div className="space-y-5">
                <div className="flex items-center gap-3 mb-4">
                  {selectedRole && (
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-xl">
                      {selectedRole.icon}
                    </div>
                  )}
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">Almost done!</h2>
                    <p className="text-xs text-gray-500">Set your location and role details</p>
                  </div>
                </div>

                {/* NGO Manager */}
                {form.role === 'ngo_manager' && (
                  <div className="space-y-3">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                      <p className="text-xs text-yellow-800 font-medium">💡 Your NGO will be reviewed by Super Admin. You can login immediately after signup.</p>
                    </div>
                    <Field label="NGO Name *" error={errors.ngoName}>
                      <input type="text" value={form.ngoName} onChange={e => set('ngoName', e.target.value)} placeholder="Your NGO name" className={ic(errors.ngoName)} />
                    </Field>
                    <Field label="NGO Description">
                      <textarea value={form.ngoDescription} onChange={e => set('ngoDescription', e.target.value)} placeholder="What does your NGO do?" rows={3} className={ic() + ' resize-none'} />
                    </Field>
                    <Field label="Website (optional)">
                      <input type="url" value={form.ngoWebsite} onChange={e => set('ngoWebsite', e.target.value)} placeholder="https://yourngo.org" className={ic()} />
                    </Field>
                  </div>
                )}

                {/* Committee / Staff - Select NGO */}
                {(form.role === 'committee_member' || form.role === 'ngo_staff') && (
                  <div className="space-y-3">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                      <p className="text-xs text-blue-800 font-medium">💡 You'll be able to login immediately. Your NGO Manager will assign you to a zone.</p>
                    </div>
                    <Field label="Select Your NGO *" error={errors.ngoId} hint="Only approved NGOs are shown">
                      {ngoLoading ? (
                        <div className="flex items-center gap-2 py-3 px-4 border-2 border-gray-200 rounded-xl text-sm text-gray-500">
                          <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                          Loading NGOs...
                        </div>
                      ) : (
                        <select value={form.ngoId} onChange={e => set('ngoId', e.target.value)} className={ic(errors.ngoId)}>
                          <option value="">-- Select an NGO --</option>
                          {ngos.map(n => (
                            <option key={n._id} value={n._id}>
                              {n.name} {n.locationName ? `• ${n.locationName}` : ''}
                            </option>
                          ))}
                        </select>
                      )}
                      {ngos.length === 0 && !ngoLoading && (
                        <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                          <p className="text-xs text-yellow-700">No approved NGOs yet. You can still register and be assigned later.</p>
                        </div>
                      )}
                    </Field>
                  </div>
                )}

                {/* Volunteer */}
                {form.role === 'volunteer' && (
                  <div className="space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                      <p className="text-xs text-green-800 font-medium">🎉 As a volunteer, you can login immediately and start applying for tasks!</p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Your Skills (optional)</label>
                      <div className="flex flex-wrap gap-2">
                        {SKILLS.map(s => (
                          <button key={s} type="button" onClick={() => toggle('skills', s)}
                            className={`px-3 py-1.5 rounded-full text-xs border-2 font-medium transition-all ${
                              form.skills.includes(s) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-blue-200'
                            }`}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Task Preferences (optional)</label>
                      <div className="flex flex-wrap gap-2">
                        {TASK_TYPES.map(t => (
                          <button key={t} type="button" onClick={() => toggle('taskPreferences', t)}
                            className={`px-3 py-1.5 rounded-full text-xs border-2 font-medium transition-all ${
                              form.taskPreferences.includes(t) ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:border-green-200'
                            }`}>
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Available Days (optional)</label>
                      <div className="flex gap-2 flex-wrap">
                        {DAYS.map(d => (
                          <button key={d} type="button" onClick={() => toggle('availableDays', d)}
                            className={`w-12 h-10 rounded-lg text-xs border-2 font-medium transition-all ${
                              form.availableDays.includes(d) ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-600'
                            }`}>
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Location Picker */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    📍 Your Location *
                  </label>
                  <p className="text-xs text-gray-400 mb-2">Click on the map to set your location</p>
                  <LocationPickerMap
                    showRadius={true}
                    defaultRadius={10}
                    onLocationSelect={(loc) => {
                      set('latitude',        loc.lat)
                      set('longitude',       loc.lng)
                      set('locationName',    loc.name)
                      set('operatingRadius', loc.radius)
                      setErrors(prev => ({ ...prev, location: '' }))
                    }}
                  />
                  {form.latitude && (
                    <div className="mt-2 bg-green-50 border border-green-200 rounded-lg p-2.5 flex items-center gap-2">
                      <span className="text-green-500">✅</span>
                      <p className="text-xs text-green-700 font-medium">{form.locationName || 'Location selected'}</p>
                    </div>
                  )}
                  {errors.location && <p className="text-red-500 text-xs mt-1">⚠️ {errors.location}</p>}
                </div>

                {errors.submit && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-start gap-2">
                    <span>⚠️</span>
                    <div>
                      <p>{errors.submit}</p>
                      {errors.submit.includes('already registered') && (
                        <Link to="/login" className="text-blue-600 font-bold hover:underline mt-1 block">→ Login instead</Link>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setStep(2)} className="flex-1 py-3 border-2 border-gray-200 rounded-xl text-gray-600 font-semibold hover:border-gray-300">← Back</button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex-1 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                        Creating...
                      </>
                    ) : (
                      '🎉 Create Account'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-blue-300 text-xs mt-5">
          🔒 Your data is secure • One account per email • Free to join
        </p>
      </div>
    </div>
  )
}