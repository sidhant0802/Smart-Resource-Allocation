import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import LocationPickerMap from '../../components/auth/LocationPickerMap'
import { authApi } from '../../api/authApi'

const ROLES = [
  {
    value:      'ngo_manager',
    label:      'NGO Manager',
    icon:       '🏢',
    desc:       'I run an NGO and manage all operations',
    badge:      'Needs Super Admin approval',
    badgeColor: 'yellow',
  },
  {
    value:      'committee_member',
    label:      'Committee Member',
    icon:       '👥',
    desc:       'I manage a specific zone for an NGO',
    badge:      'Needs NGO Manager approval',
    badgeColor: 'blue',
  },
  {
    value:      'ngo_staff',
    label:      'NGO Staff',
    icon:       '📋',
    desc:       'I collect and upload field data for an NGO',
    badge:      'Needs Committee approval',
    badgeColor: 'green',
  },
  {
    value:      'volunteer',
    label:      'Volunteer',
    icon:       '🙋',
    desc:       'I want to help with tasks near my location',
    badge:      'Needs Committee approval',
    badgeColor: 'green',
  },
]

const SKILLS = [
  'Medical', 'Teaching', 'Driving', 'Cooking',
  'Construction', 'Counseling', 'Technology',
  'Logistics', 'Photography', 'Translation',
]

const TASK_TYPES = [
  'Health', 'Food', 'Water', 'Education',
  'Shelter', 'Sanitation', 'Disaster Relief',
  'Infrastructure', 'Women Safety', 'Child Welfare',
]

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      {children}
      {error && (
        <p className="text-red-500 text-xs mt-1">{error}</p>
      )}
    </div>
  )
}

function inputClass(hasError) {
  return `w-full px-4 py-2.5 border rounded-xl text-sm
          focus:outline-none focus:ring-2 focus:ring-blue-500
          transition-colors
          ${hasError ? 'border-red-300 bg-red-50' : 'border-gray-200'}`
}

export default function Signup() {
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [ngos, setNgos] = useState([])

  const [form, setForm] = useState({
    role: '',
    fullName: '', email: '', password: '',
    confirmPassword: '', phone: '',
    latitude: null, longitude: null,
    locationName: '', operatingRadius: 10,
    ngoName: '', ngoDescription: '', ngoWebsite: '',
    ngoId: '',
    skills: [], taskPreferences: [],
    availableDays: [], availableTime: '',
  })

  const [errors, setErrors]     = useState({})
  const [loading, setLoading]   = useState(false)
  const [showPass, setShowPass] = useState(false)

  useEffect(() => {
    if (
      form.role === 'committee_member' ||
      form.role === 'ngo_staff'
    ) {
      authApi.getApprovedNgos()
        .then(res => setNgos(res.ngos || []))
        .catch(() => setNgos([]))
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
    if (!form.role) {
      setErrors({ role: 'Please select your role' })
      return false
    }
    return true
  }

  const validateStep2 = () => {
    const errs = {}
    if (!form.fullName.trim())
      errs.fullName = 'Full name is required'
    if (!form.email.trim())
      errs.email = 'Email is required'
    if (!/\S+@\S+\.\S+/.test(form.email))
      errs.email = 'Enter a valid email'
    if (form.password.length < 6)
      errs.password = 'Minimum 6 characters'
    if (form.password !== form.confirmPassword)
      errs.confirmPassword = 'Passwords do not match'
    if (!form.phone.trim())
      errs.phone = 'Phone number is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const validateStep3 = () => {
    const errs = {}
    if (!form.latitude || !form.longitude)
      errs.location = 'Please select your location on the map'
    if (form.role === 'ngo_manager' && !form.ngoName.trim())
      errs.ngoName = 'NGO name is required'
    if (
      (form.role === 'committee_member' || form.role === 'ngo_staff')
      && !form.ngoId
    )
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
            ? '✅ Account created! NGO is pending Super Admin approval.'
            : '✅ Account created! Waiting for approval.',
        },
      })
    } catch (err) {
      setErrors({ submit: err.message })
    } finally {
      setLoading(false)
    }
  }

  const progress = (step / 3) * 100
  const stepTitles = ['Select Role', 'Basic Info', 'Details & Location']

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50
                    via-white to-indigo-50 flex items-center
                    justify-center p-4 py-10">
      <div className="bg-white rounded-2xl shadow-xl w-full
                      max-w-lg overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600
                        p-6 text-white">
          <h1 className="text-xl font-bold">Join the Platform</h1>
          <p className="text-blue-100 text-xs mt-0.5">
            Smart Resource Allocation for Social Impact
          </p>
          <div className="mt-4">
            <div className="flex justify-between text-xs
                            text-blue-200 mb-1.5">
              {stepTitles.map((t, i) => (
                <span key={t}
                      className={i + 1 <= step
                        ? 'text-white font-medium' : ''}>
                  {i + 1}. {t}
                </span>
              ))}
            </div>
            <div className="h-1.5 bg-blue-400 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all
                           duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="p-6">

          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-gray-800 mb-4">
                Who are you signing up as?
              </h2>

              {ROLES.map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => set('role', r.value)}
                  className={`w-full text-left p-4 rounded-xl border-2
                              transition-all
                    ${form.role === r.value
                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                      : 'border-gray-200 hover:border-blue-200'
                    }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl mt-0.5">{r.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-800 text-sm">
                          {r.label}
                        </p>
                        {form.role === r.value && (
                          <span className="text-blue-500">✓</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {r.desc}
                      </p>
                      <span className={`inline-block mt-1.5 text-xs
                                       px-2 py-0.5 rounded-full
                        ${r.badgeColor === 'yellow'
                          ? 'bg-yellow-100 text-yellow-700'
                          : r.badgeColor === 'blue'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-green-100 text-green-700'
                        }`}>
                        ⚡ {r.badge}
                      </span>
                    </div>
                  </div>
                </button>
              ))}

              {errors.role && (
                <p className="text-red-500 text-xs">{errors.role}</p>
              )}

              <button
                onClick={handleNext}
                className="w-full mt-2 py-3 bg-blue-600 text-white
                           rounded-xl font-semibold hover:bg-blue-700"
              >
                Continue →
              </button>

              <p className="text-center text-sm text-gray-500">
                Already have an account?{' '}
                <Link to="/login"
                      className="text-blue-600 font-medium hover:underline">
                  Login
                </Link>
              </p>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-800">
                Basic Information
              </h2>

              <Field label="Full Name *" error={errors.fullName}>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={e => set('fullName', e.target.value)}
                  placeholder="Your full name"
                  className={inputClass(errors.fullName)}
                />
              </Field>

              <Field label="Email Address *" error={errors.email}>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  placeholder="your@email.com"
                  className={inputClass(errors.email)}
                />
              </Field>

              <Field label="Password *" error={errors.password}>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => set('password', e.target.value)}
                    placeholder="Minimum 6 characters"
                    className={inputClass(errors.password) + ' pr-10'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2
                               text-gray-400"
                  >
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </Field>

              <Field label="Confirm Password *" error={errors.confirmPassword}>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={e => set('confirmPassword', e.target.value)}
                  placeholder="Repeat your password"
                  className={inputClass(errors.confirmPassword)}
                />
              </Field>

              <Field label="Phone Number *" error={errors.phone}>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                  placeholder="+91 XXXXXXXXXX"
                  className={inputClass(errors.phone)}
                />
              </Field>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 border-2 border-gray-200
                             rounded-xl text-gray-600 font-semibold
                             hover:border-gray-300"
                >
                  ← Back
                </button>
                <button
                  onClick={handleNext}
                  className="flex-1 py-3 bg-blue-600 text-white
                             rounded-xl font-semibold hover:bg-blue-700"
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-gray-800">
                {form.role === 'ngo_manager'      && 'NGO Details & Location'}
                {form.role === 'volunteer'         && 'Skills & Location'}
                {form.role === 'committee_member'  && 'NGO & Location'}
                {form.role === 'ngo_staff'         && 'NGO & Location'}
              </h2>

              {/* NGO Manager */}
              {form.role === 'ngo_manager' && (
                <div className="space-y-3">
                  <Field label="NGO Name *" error={errors.ngoName}>
                    <input
                      type="text"
                      value={form.ngoName}
                      onChange={e => set('ngoName', e.target.value)}
                      placeholder="Your NGO name"
                      className={inputClass(errors.ngoName)}
                    />
                  </Field>
                  <Field label="NGO Description">
                    <textarea
                      value={form.ngoDescription}
                      onChange={e => set('ngoDescription', e.target.value)}
                      placeholder="What does your NGO do?"
                      rows={3}
                      className={inputClass() + ' resize-none'}
                    />
                  </Field>
                  <Field label="Website (optional)">
                    <input
                      type="url"
                      value={form.ngoWebsite}
                      onChange={e => set('ngoWebsite', e.target.value)}
                      placeholder="https://yourngo.org"
                      className={inputClass()}
                    />
                  </Field>
                </div>
              )}

              {/* Committee / Staff */}
              {(form.role === 'committee_member' ||
                form.role === 'ngo_staff') && (
                <Field label="Select Your NGO *" error={errors.ngoId}>
                  <select
                    value={form.ngoId}
                    onChange={e => set('ngoId', e.target.value)}
                    className={inputClass(errors.ngoId)}
                  >
                    <option value="">-- Select NGO --</option>
                    {ngos.map(n => (
                      <option key={n._id} value={n._id}>
                        {n.name}
                      </option>
                    ))}
                  </select>
                  {ngos.length === 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                      No approved NGOs found yet
                    </p>
                  )}
                </Field>
              )}

              {/* Volunteer */}
              {form.role === 'volunteer' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium
                                      text-gray-700 mb-2">
                      Your Skills
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {SKILLS.map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => toggle('skills', s)}
                          className={`px-3 py-1.5 rounded-full text-xs
                                      border-2 font-medium transition-all
                            ${form.skills.includes(s)
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 text-gray-600'
                            }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium
                                      text-gray-700 mb-2">
                      Task Types You Want to Serve
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {TASK_TYPES.map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => toggle('taskPreferences', t)}
                          className={`px-3 py-1.5 rounded-full text-xs
                                      border-2 font-medium transition-all
                            ${form.taskPreferences.includes(t)
                              ? 'border-green-500 bg-green-50 text-green-700'
                              : 'border-gray-200 text-gray-600'
                            }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium
                                      text-gray-700 mb-2">
                      Available Days
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {DAYS.map(d => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggle('availableDays', d)}
                          className={`w-12 h-10 rounded-lg text-xs
                                      border-2 font-medium transition-all
                            ${form.availableDays.includes(d)
                              ? 'border-purple-500 bg-purple-50 text-purple-700'
                              : 'border-gray-200 text-gray-600'
                            }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Field label="Available Time">
                    <select
                      value={form.availableTime}
                      onChange={e => set('availableTime', e.target.value)}
                      className={inputClass()}
                    >
                      <option value="">Select time preference</option>
                      <option value="morning">Morning (6AM–12PM)</option>
                      <option value="afternoon">Afternoon (12–6PM)</option>
                      <option value="evening">Evening (6–10PM)</option>
                      <option value="anytime">Anytime</option>
                    </select>
                  </Field>
                </div>
              )}

              {/* Location Map */}
              <div>
                <label className="block text-sm font-medium
                                  text-gray-700 mb-2">
                  📍 Your Operating Location *
                </label>
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
                {errors.location && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.location}
                  </p>
                )}
              </div>

              {errors.submit && (
                <div className="bg-red-50 border border-red-200
                                rounded-xl p-3 text-sm text-red-700">
                  {errors.submit}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-1 py-3 border-2 border-gray-200
                             rounded-xl text-gray-600 font-semibold
                             hover:border-gray-300"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 py-3 bg-blue-600 text-white
                             rounded-xl font-semibold hover:bg-blue-700
                             disabled:opacity-60 flex items-center
                             justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2
                                      border-white border-t-transparent
                                      rounded-full"/>
                      Creating...
                    </>
                  ) : (
                    'Create Account ✓'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}