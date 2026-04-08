import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { uploadApi, chatApi } from '../../api/authApi'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

const SEVERITY_CONFIG = {
  critical: { bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-l-red-500',    label: '🔴 CRITICAL',  bar: 'bg-red-500',    score: 'text-red-600' },
  high:     { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-l-orange-500', label: '🟠 HIGH',      bar: 'bg-orange-500', score: 'text-orange-600' },
  medium:   { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-l-yellow-500', label: '🟡 MEDIUM',    bar: 'bg-yellow-500', score: 'text-yellow-600' },
  low:      { bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-l-green-500',  label: '🟢 LOW',       bar: 'bg-green-500',  score: 'text-green-600' },
  info:     { bg: 'bg-gray-100',   text: 'text-gray-700',   border: 'border-l-gray-300',   label: '⚪ INFO',      bar: 'bg-gray-400',   score: 'text-gray-600' },
}

export default function NgoStaffDashboard() {
  const { user, logout } = useAuth()
  const navigate         = useNavigate()

  const [activeTab, setActiveTab]           = useState('upload')
  const [myReports, setMyReports]           = useState([])
  const [loadingReports, setLoadingReports] = useState(false)

  // Upload form
  const [uploadType, setUploadType]               = useState(null)
  const [file, setFile]                           = useState(null)
  const [textInput, setTextInput]                 = useState('')
  const [title, setTitle]                         = useState('')
  const [description, setDescription]             = useState('')
  const [uploading, setUploading]                 = useState(false)
  const [uploadedReportId, setUploadedReportId]   = useState(null)
  const [polledReport, setPolledReport]           = useState(null)
  const [polling, setPolling]                     = useState(false)

  // Location
  const [reportLocation, setReportLocation]     = useState(null)
  const [locationName, setLocationName]         = useState('')
  const [showLocationPicker, setShowLocationPicker] = useState(false)

  // Voice
  const [recording, setRecording] = useState(false)
  const [voiceText, setVoiceText] = useState('')
  const recognitionRef            = useRef(null)

  // Visibility
  const [visibilityLoading, setVisibilityLoading] = useState(null)
  const [showSendConfirm, setShowSendConfirm]     = useState(null)

  // Chat states
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput]       = useState('')
  const [chatLoading, setChatLoading]   = useState(false)
  const [showChat, setShowChat]         = useState(false)
  const chatEndRef                      = useRef(null)

  // Map for location picker
  const locationMapContainer = useRef(null)
  const locationMap          = useRef(null)
  const locationMarker       = useRef(null)

  // Reports map
  const reportsMapContainer = useRef(null)
  const reportsMap          = useRef(null)

  useEffect(() => {
    if (activeTab === 'reports') fetchMyReports()
  }, [activeTab])

  // Initialize location picker map
  useEffect(() => {
    if (!showLocationPicker || !locationMapContainer.current || locationMap.current) return

    setTimeout(() => {
      const userLoc = user?.location?.coordinates || [77.2090, 28.6139]
      
      locationMap.current = new mapboxgl.Map({
        container: locationMapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: userLoc,
        zoom: 12,
      })

      locationMap.current.on('click', async (e) => {
        const { lng, lat } = e.lngLat
        
        if (locationMarker.current) locationMarker.current.remove()
        
        locationMarker.current = new mapboxgl.Marker({ color: '#3B82F6' })
          .setLngLat([lng, lat])
          .addTo(locationMap.current)

        locationMap.current.flyTo({ center: [lng, lat], zoom: 14 })

        // Reverse geocoding
        try {
          const res = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxgl.accessToken}&language=en`
          )
          const data = await res.json()
          const placeName = data.features?.[0]?.place_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
          
          setReportLocation({ latitude: lat, longitude: lng })
          setLocationName(placeName)
        } catch (err) {
          setReportLocation({ latitude: lat, longitude: lng })
          setLocationName(`${lat.toFixed(4)}, ${lng.toFixed(4)}`)
        }
      })
    }, 300)

    return () => {
      if (locationMap.current) {
        locationMap.current.remove()
        locationMap.current = null
      }
    }
  }, [showLocationPicker])

  // Initialize reports map
  useEffect(() => {
    if (activeTab !== 'reports' || !reportsMapContainer.current || reportsMap.current || myReports.length === 0) return

    const reportsWithLocation = myReports.filter(r => r.location?.coordinates)
    if (reportsWithLocation.length === 0) return

    reportsMap.current = new mapboxgl.Map({
      container: reportsMapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: user?.location?.coordinates || [77.2090, 28.6139],
      zoom: 10,
    })

    reportsMap.current.addControl(new mapboxgl.NavigationControl(), 'top-right')

    const bounds = new mapboxgl.LngLatBounds()

    reportsWithLocation.forEach(report => {
      const [lng, lat] = report.location.coordinates
      const severity = report.analysis?.severityLevel || 'info'
      
      const markerColor = {
        critical: '#EF4444',
        high: '#F59E0B',
        medium: '#FBBF24',
        low: '#10B981',
        info: '#6B7280'
      }[severity] || '#6B7280'

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div style="padding:10px;min-width:200px;">
          <h3 style="font-weight:bold;font-size:14px;margin:0 0 4px 0;">${report.title}</h3>
          <p style="font-size:11px;color:#666;margin:0 0 6px 0;">
            ${SEVERITY_CONFIG[severity]?.label || 'INFO'}
          </p>
          <div style="background:#f3f4f6;padding:4px 8px;border-radius:6px;margin-bottom:6px;">
            <p style="font-size:10px;color:#666;margin:0;">Urgency: ${report.analysis?.urgencyScore || 0}/100</p>
          </div>
          <p style="font-size:11px;color:#999;margin:4px 0 0 0;">
            ${report.visibility === 'sent' ? '✅ Sent to Committee' : '📝 Draft'}
          </p>
        </div>
      `)

      new mapboxgl.Marker({ color: markerColor })
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(reportsMap.current)

      bounds.extend([lng, lat])
    })

    if (reportsWithLocation.length > 1) {
      reportsMap.current.fitBounds(bounds, { padding: 60, maxZoom: 12 })
    }

    return () => {
      if (reportsMap.current) {
        reportsMap.current.remove()
        reportsMap.current = null
      }
    }
  }, [activeTab, myReports])

  const fetchMyReports = async () => {
    setLoadingReports(true)
    try {
      const res = await uploadApi.getMyReports()
      setMyReports(res.reports || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingReports(false)
    }
  }

  const pollStatus = (reportId) => {
    setPolling(true)
    let attempts = 0

    const interval = setInterval(async () => {
      attempts++
      try {
        const res = await uploadApi.getStatus(reportId)
        if (res.report.status === 'analyzed') {
          clearInterval(interval)
          setPolling(false)
          setPolledReport(res.report)
          setShowChat(true)
          setChatMessages([])
        }
      } catch (err) {
        console.error(err)
      }
      if (attempts >= 30) {
        clearInterval(interval)
        setPolling(false)
      }
    }, 2000)
  }

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !polledReport) return

    const userMsg = chatInput.trim()
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setChatLoading(true)

    try {
      const res = await chatApi.sendMessage({
        reportId: polledReport._id,
        message:  userMsg,
      })

      setChatMessages(prev => [
        ...prev,
        {
          role:           'assistant',
          content:        res.message,
          recommendation: res.recommendation,
          confidence:     res.confidence,
        }
      ])
    } catch (err) {
      setChatMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I am unavailable right now.' }
      ])
    } finally {
      setChatLoading(false)
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const handleUpload = async () => {
    if (!uploadType) return alert('Select upload type')
    if (!title.trim()) return alert('Enter a title')
    if (!reportLocation) return alert('Select report location on map')

    const formData = new FormData()
    formData.append('title', title)
    formData.append('visibility', 'draft')
    formData.append('latitude', reportLocation.latitude)
    formData.append('longitude', reportLocation.longitude)
    formData.append('locationName', locationName)

    if (uploadType === 'text') {
      if (!textInput.trim()) return alert('Enter text')
      formData.append('description', textInput)
    } else if (uploadType === 'voice') {
      if (!voiceText.trim()) return alert('Record voice first')
      formData.append('voiceText', voiceText)
      formData.append('description', voiceText)
    } else {
      if (!file) return alert('Select a file')
      formData.append('file', file)
      if (description) formData.append('description', description)
    }

    setUploading(true)
    setPolledReport(null)
    setShowChat(false)
    setChatMessages([])

    try {
      const res = await uploadApi.uploadFile(formData)
      setUploadedReportId(res.reportId)
      setUploading(false)
      pollStatus(res.reportId)
    } catch (err) {
      setUploading(false)
      alert('Upload failed: ' + err.message)
    }
  }

  const handleSendToCommittee = async (reportId) => {
    setVisibilityLoading(reportId)
    try {
      await uploadApi.updateVisibility(reportId, 'sent')
      
      // Update local state
      if (polledReport?._id === reportId) {
        setPolledReport(prev => ({ ...prev, visibility: 'sent' }))
      }
      if (activeTab === 'reports') {
        fetchMyReports()
      } else {
        setMyReports(prev =>
          prev.map(r => r._id === reportId ? { ...r, visibility: 'sent' } : r)
        )
      }
      
      setShowSendConfirm(null)
      
      // Show success message
      alert('✅ Report successfully sent to committee! They will review it soon.')
    } catch (err) {
      alert('Failed to send: ' + err.message)
    } finally {
      setVisibilityLoading(null)
    }
  }

  const handleVisibility = async (reportId, visibility) => {
    setVisibilityLoading(reportId)
    try {
      await uploadApi.updateVisibility(reportId, visibility)
      if (polledReport?._id === reportId) {
        setPolledReport(prev => ({ ...prev, visibility }))
      }
      if (activeTab === 'reports') fetchMyReports()
      else setMyReports(prev =>
        prev.map(r => r._id === reportId ? { ...r, visibility } : r)
      )
    } catch (err) {
      alert('Failed: ' + err.message)
    } finally {
      setVisibilityLoading(null)
    }
  }

  const startRecording = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      return alert('Use Chrome for voice recording')
    }
    const SR  = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR()
    rec.continuous     = true
    rec.interimResults = true
    rec.lang           = 'en-IN'
    rec.onresult = (e) => {
      let t = ''
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript
      setVoiceText(t)
    }
    rec.onend = () => setRecording(false)
    rec.start()
    recognitionRef.current = rec
    setRecording(true)
  }

  const stopRecording = () => {
    recognitionRef.current?.stop()
    setRecording(false)
  }

  const resetForm = () => {
    setUploadType(null)
    setFile(null)
    setTextInput('')
    setVoiceText('')
    setTitle('')
    setDescription('')
    setPolledReport(null)
    setUploadedReportId(null)
    setShowChat(false)
    setChatMessages([])
    setReportLocation(null)
    setLocationName('')
    setShowLocationPicker(false)
  }

  const handleLogout = () => { logout(); navigate('/login') }
  const sev = (l) => SEVERITY_CONFIG[l] || SEVERITY_CONFIG.info

  // Get NGO info from user
  const ngoName = user?.ngo?.name || 'NGO'
  const ngoZone = user?.assignedZone?.name || user?.zone?.name || 'Unassigned Zone'

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">📋</span>
              <div>
                <h1 className="font-bold text-gray-800">NGO Field Staff</h1>
                <p className="text-xs text-gray-500">{user?.fullName}</p>
              </div>
            </div>
            
            {/* NGO Badge */}
            <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
              <span className="text-lg">🏢</span>
              <div>
                <p className="text-xs text-blue-600 font-semibold">{ngoName}</p>
                <p className="text-xs text-blue-500">📍 {ngoZone}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user?.locationName && (
              <span className="hidden md:block text-xs text-gray-400">
                📍 {user.locationName}
              </span>
            )}
            <button onClick={handleLogout}
              className="text-sm bg-red-50 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 font-medium">
              Logout
            </button>
          </div>
        </div>
        
        {/* Mobile NGO Info */}
        <div className="md:hidden mt-3 flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
          <span>🏢</span>
          <div className="flex-1">
            <p className="text-xs text-blue-700 font-semibold">{ngoName}</p>
            <p className="text-xs text-blue-600">Zone: {ngoZone}</p>
          </div>
        </div>
      </nav>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex">
          {[
            { key: 'upload',  label: '📤 New Report', icon: '➕' },
            { key: 'reports', label: '📋 My Reports', badge: myReports.length },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-5 py-3 text-sm font-medium flex items-center gap-2 ${
                activeTab === t.key
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
              {t.badge > 0 && (
                <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-6">

        {/* ══ UPLOAD TAB ══ */}
        {activeTab === 'upload' && (
          <div className="space-y-5">

            {/* NGO Info Card */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 text-white">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">🏢</span>
                <div className="flex-1">
                  <h3 className="font-bold text-lg">{ngoName}</h3>
                  <p className="text-blue-100 text-sm">Operating Zone: {ngoZone}</p>
                </div>
              </div>
              <p className="text-blue-100 text-sm">
                📝 Reports you submit will be reviewed by your committee members
              </p>
            </div>

            {/* AI Result Card */}
            {polledReport && (
              <div className={`rounded-2xl border-2 overflow-hidden ${sev(polledReport.analysis?.severityLevel).border.replace('border-l-', 'border-')}`}>

                {/* Header */}
                <div className={`p-4 ${sev(polledReport.analysis?.severityLevel).bg} flex items-center justify-between`}>
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg">🤖 Gemini AI Analysis Complete</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Model: {polledReport.analysis?.model || 'gemini-1.5-flash'}
                      {polledReport.analysis?.processingTime &&
                        ` • ${(polledReport.analysis.processingTime / 1000).toFixed(1)}s`}
                    </p>
                  </div>
                  <button onClick={resetForm}
                    className="text-xs text-gray-500 hover:text-gray-700 bg-white px-3 py-1.5 rounded-lg border border-gray-200">
                    New Report
                  </button>
                </div>

                <div className="bg-white p-5 space-y-4">

                  {/* Score + Severity */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-500">Urgency Score</p>
                      <p className={`text-3xl font-bold mt-1 ${sev(polledReport.analysis?.severityLevel).score}`}>
                        {polledReport.analysis?.urgencyScore || 0}
                      </p>
                      <p className="text-xs text-gray-400">/ 100</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-500">Severity</p>
                      <p className={`text-sm font-bold mt-2 ${sev(polledReport.analysis?.severityLevel).text}`}>
                        {sev(polledReport.analysis?.severityLevel).label}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-500">Category</p>
                      <p className="text-sm font-bold mt-2 text-gray-800">
                        {polledReport.analysis?.category || '—'}
                      </p>
                    </div>
                  </div>

                  {/* Score Bar */}
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Urgency Level</span>
                      <span>{polledReport.analysis?.urgencyScore}/100</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-4">
                      <div
                        className={`h-4 rounded-full transition-all ${sev(polledReport.analysis?.severityLevel).bar}`}
                        style={{ width: `${polledReport.analysis?.urgencyScore || 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Location Info */}
                  {polledReport.locationName && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
                      <span className="text-blue-500 text-xl">📍</span>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-blue-700">Report Location</p>
                        <p className="text-sm text-blue-600">{polledReport.locationName}</p>
                      </div>
                    </div>
                  )}

                  {/* Immediate Risk */}
                  {polledReport.analysis?.immediateRisk && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                      <span className="text-red-500 text-xl">⚠️</span>
                      <p className="text-red-700 text-sm font-medium">
                        IMMEDIATE RISK DETECTED — Urgent intervention required
                      </p>
                    </div>
                  )}

                  {/* AI Summary */}
                  <div className={`rounded-xl p-4 ${sev(polledReport.analysis?.severityLevel).bg}`}>
                    <p className="text-xs font-semibold text-gray-600 mb-1">🤖 AI Summary</p>
                    <p className="text-sm text-gray-800 leading-relaxed">{polledReport.analysis?.summary}</p>
                  </div>

                  {/* Key Problems */}
                  {polledReport.analysis?.keyProblems?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-2">🔍 Key Problems Identified</p>
                      <ul className="space-y-1">
                        {polledReport.analysis.keyProblems.map((p, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                            <span className="text-red-500 mt-0.5">•</span>{p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Suggested Actions */}
                  {polledReport.analysis?.suggestedActions?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-2">✅ Suggested Actions</p>
                      <ul className="space-y-1">
                        {polledReport.analysis.suggestedActions.map((a, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                            <span className="text-green-500 mt-0.5">→</span>{a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Send / Draft Decision */}
                  <div className="border-t border-gray-100 pt-4">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 mb-3">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">🏢</span>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-800 mb-1">
                            Submit to {ngoName} Committee
                          </p>
                          <p className="text-xs text-gray-600 leading-relaxed">
                            Your committee members in <strong>{ngoZone}</strong> will review this report and decide on actions. 
                            {polledReport.analysis?.urgencyScore >= 75 && (
                              <span className="text-red-600 font-semibold"> ⚠️ High urgency - recommend sending immediately!</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    {polledReport.visibility !== 'sent' ? (
                      <div className="space-y-3">
                        <button
                          onClick={() => setShowSendConfirm(polledReport._id)}
                          disabled={visibilityLoading === polledReport._id}
                          className="w-full py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-semibold text-sm hover:from-green-700 hover:to-green-800 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          <span>📤</span>
                          Send to Committee for Review
                        </button>
                        <button
                          onClick={() => handleVisibility(polledReport._id, 'draft')}
                          disabled={visibilityLoading === polledReport._id}
                          className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-200 disabled:opacity-50"
                        >
                          📝 Keep as Draft (Send Later)
                        </button>
                      </div>
                    ) : (
                      <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4 text-center">
                        <div className="text-4xl mb-2">✅</div>
                        <p className="text-green-800 font-bold mb-1">Report Submitted!</p>
                        <p className="text-green-600 text-sm">
                          Committee members can now see this report and will take action
                        </p>
                        <button
                          onClick={() => handleVisibility(polledReport._id, 'draft')}
                          disabled={visibilityLoading === polledReport._id}
                          className="mt-3 text-xs text-green-700 hover:underline disabled:opacity-50"
                        >
                          ↩️ Move back to draft
                        </button>
                      </div>
                    )}
                  </div>

                  {/* AI Chat Section */}
                  <div className="border-t border-gray-100 pt-4">
                    <button
                      onClick={() => setShowChat(!showChat)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🤖</span>
                        <span className="font-semibold text-indigo-700 text-sm">Ask AI about this report</span>
                      </div>
                      <span className="text-indigo-500 text-xs">{showChat ? '▲ Hide' : '▼ Open Chat'}</span>
                    </button>

                    {showChat && (
                      <div className="mt-3 border border-indigo-100 rounded-xl overflow-hidden">
                        <div className="h-64 overflow-y-auto p-4 space-y-3 bg-gray-50">
                          {chatMessages.length === 0 && (
                            <div className="text-center text-gray-400 text-sm mt-8">
                              <p className="text-2xl mb-2">💬</p>
                              <p>Ask anything about this report</p>
                              <p className="text-xs mt-1">e.g. "Should I send this?" or "How urgent is this?"</p>
                            </div>
                          )}

                          {chatMessages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-xs px-4 py-2.5 rounded-2xl text-sm ${
                                msg.role === 'user'
                                  ? 'bg-indigo-600 text-white rounded-br-sm'
                                  : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm shadow-sm'
                              }`}>
                                <p>{msg.content}</p>
                                {msg.recommendation && (
                                  <p className={`text-xs mt-1.5 font-semibold ${
                                    msg.recommendation === 'send' ? 'text-green-400' : 'text-yellow-400'
                                  }`}>
                                    Recommendation: {msg.recommendation === 'send' ? '📤 Send it' : '📝 Keep draft'}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}

                          {chatLoading && (
                            <div className="flex justify-start">
                              <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                                <div className="flex gap-1">
                                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                              </div>
                            </div>
                          )}
                          <div ref={chatEndRef} />
                        </div>

                        <div className="flex gap-2 p-3 bg-white border-t border-gray-100">
                          <input
                            type="text"
                            value={chatInput}
                            onChange={e => setChatInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                            placeholder="Ask about this report..."
                            disabled={chatLoading}
                            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
                          />
                          <button
                            onClick={sendChatMessage}
                            disabled={chatLoading || !chatInput.trim()}
                            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-xl hover:bg-indigo-700 disabled:opacity-50 font-medium"
                          >
                            Send
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Polling State */}
            {polling && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-8 text-center">
                <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
                <p className="font-bold text-blue-800 text-lg">🤖 Gemini AI Analyzing...</p>
                <p className="text-sm text-blue-600 mt-1">Reading content • Detecting severity • Generating insights</p>
              </div>
            )}

            {/* Upload Form */}
            {!polledReport && !polling && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Report Title *</label>
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                    placeholder="Brief title of the community issue"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Location Picker */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Report Location * 
                    <span className="text-xs text-gray-500 ml-1">(Where is this issue happening?)</span>
                  </label>
                  
                  {!reportLocation ? (
                    <button
                      onClick={() => setShowLocationPicker(true)}
                      className="w-full py-3 border-2 border-dashed border-blue-300 rounded-xl text-blue-600 hover:bg-blue-50 flex items-center justify-center gap-2 font-medium"
                    >
                      <span>📍</span> Click to select location on map
                    </button>
                  ) : (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-green-500 text-xl">✅</span>
                          <div>
                            <p className="text-sm font-medium text-green-800">Location Selected</p>
                            <p className="text-xs text-green-600">{locationName}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setReportLocation(null)
                            setLocationName('')
                            setShowLocationPicker(true)
                          }}
                          className="text-xs text-green-700 hover:underline"
                        >
                          Change
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Upload Type *</label>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { type: 'pdf',   icon: '📄', label: 'PDF' },
                      { type: 'image', icon: '🖼️',  label: 'Image' },
                      { type: 'voice', icon: '🎤', label: 'Voice' },
                      { type: 'text',  icon: '✏️',  label: 'Text' },
                    ].map(opt => (
                      <button key={opt.type} onClick={() => setUploadType(opt.type)}
                        className={`p-4 rounded-xl border-2 text-center transition-all ${
                          uploadType === opt.type ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 hover:border-blue-200'
                        }`}
                      >
                        <div className="text-3xl mb-1">{opt.icon}</div>
                        <p className="text-xs font-medium text-gray-700">{opt.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {uploadType === 'pdf' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">PDF File</label>
                    <input type="file" accept=".pdf" onChange={e => setFile(e.target.files[0])}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" />
                    {file && <p className="text-xs text-green-600 mt-1">✅ {file.name}</p>}
                  </div>
                )}

                {uploadType === 'image' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Image File</label>
                    <input type="file" accept="image/*" onChange={e => setFile(e.target.files[0])}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" />
                    {file && (
                      <img src={URL.createObjectURL(file)} alt="preview"
                        className="mt-2 w-full h-40 object-cover rounded-xl border border-gray-200" />
                    )}
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Describe what's in the image (helps AI)
                      </label>
                      <textarea value={description} onChange={e => setDescription(e.target.value)}
                        placeholder="e.g., Flooded street, broken drainage pipe..."
                        rows={3} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                    </div>
                  </div>
                )}

                {uploadType === 'voice' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Voice Recording</label>
                    <div className="bg-gray-50 rounded-xl p-6 text-center">
                      <button
                        onClick={recording ? stopRecording : startRecording}
                        className={`w-24 h-24 rounded-full text-4xl transition-all mx-auto block shadow-lg ${
                          recording ? 'bg-red-500 text-white animate-pulse scale-110' : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105'
                        }`}
                      >
                        {recording ? '⏹️' : '🎤'}
                      </button>
                      <p className="text-sm text-gray-500 mt-3">
                        {recording ? '🔴 Recording... tap to stop' : 'Tap to start recording'}
                      </p>
                    </div>
                    {voiceText && (
                      <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-4">
                        <p className="text-xs font-medium text-green-600 mb-1">✅ Transcribed:</p>
                        <p className="text-sm text-gray-800">{voiceText}</p>
                      </div>
                    )}
                  </div>
                )}

                {uploadType === 'text' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Describe the Issue *</label>
                    <textarea value={textInput} onChange={e => setTextInput(e.target.value)}
                      placeholder="Describe the community problem in detail..."
                      rows={8} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                    <p className="text-xs text-gray-400 mt-1">{textInput.length} characters</p>
                  </div>
                )}

                {uploadType && (
                  <button onClick={handleUpload} disabled={uploading}
                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2 text-base"
                  >
                    {uploading ? (
                      <><div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" /> Uploading...</>
                    ) : '🤖 Analyze with Gemini AI →'}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* ══ MY REPORTS TAB ══ */}
        {activeTab === 'reports' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-800">My Reports ({myReports.length})</h3>
                <p className="text-xs text-gray-500 mt-0.5">Submitted to {ngoName} • {ngoZone}</p>
              </div>
              <button onClick={fetchMyReports} className="text-xs text-blue-600 hover:underline">
                🔄 Refresh
              </button>
            </div>

            {/* Reports Map */}
            {myReports.filter(r => r.location?.coordinates).length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <span>🗺️</span> Reports Map
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    🔴 Critical • 🟠 High • 🟡 Medium • 🟢 Low • ⚪ Info
                  </p>
                </div>
                <div ref={reportsMapContainer} className="w-full h-80" />
              </div>
            )}

            {loadingReports ? (
              <div className="text-center py-12">
                <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
              </div>
            ) : myReports.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
                <p className="text-5xl mb-3">📋</p>
                <h3 className="text-lg font-semibold text-gray-800">No reports yet</h3>
                <p className="text-gray-500 text-sm mt-1">Upload your first report to start documenting community issues</p>
                <button
                  onClick={() => setActiveTab('upload')}
                  className="mt-4 bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700"
                >
                  ➕ Create First Report
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {myReports.map(report => (
                  <div key={report._id}
                    className={`bg-white rounded-2xl shadow-sm border-l-4 ${
                      report.analysis?.severityLevel === 'critical' ? 'border-l-red-500' :
                      report.analysis?.severityLevel === 'high'     ? 'border-l-orange-500' :
                      report.analysis?.severityLevel === 'medium'   ? 'border-l-yellow-500' :
                      report.analysis?.severityLevel === 'low'      ? 'border-l-green-500' :
                      'border-l-gray-300'
                    } overflow-hidden hover:shadow-md transition-shadow`}
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-800">{report.title}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-gray-400">{new Date(report.createdAt).toLocaleString()}</p>
                            {report.locationName && (
                              <span className="text-xs text-gray-400">• 📍 {report.locationName.split(',')[0]}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${sev(report.analysis?.severityLevel).bg} ${sev(report.analysis?.severityLevel).text}`}>
                            {sev(report.analysis?.severityLevel).label}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            report.visibility === 'sent' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {report.visibility === 'sent' ? '✅ Sent' : '📝 Draft'}
                          </span>
                        </div>
                      </div>

                      {report.status === 'processing' ? (
                        <div className="flex items-center gap-2 text-blue-600 text-sm">
                          <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                          Gemini AI analyzing...
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-xs text-gray-500 w-24">Urgency</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                              <div className={`h-2.5 rounded-full ${sev(report.analysis?.severityLevel).bar}`}
                                style={{ width: `${report.analysis?.urgencyScore || 0}%` }} />
                            </div>
                            <span className="text-sm font-bold text-gray-700 w-12 text-right">
                              {report.analysis?.urgencyScore || 0}/100
                            </span>
                          </div>

                          {report.analysis?.summary && (
                            <p className="text-xs text-gray-600 leading-relaxed mb-3 line-clamp-2">
                              {report.analysis.summary}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {report.analysis?.category && (
                              <span className="bg-blue-50 text-blue-600 text-xs px-2 py-0.5 rounded-full">
                                {report.analysis.category}
                              </span>
                            )}
                            {report.analysis?.keywords?.slice(0, 3).map(kw => (
                              <span key={kw} className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">{kw}</span>
                            ))}
                          </div>

                          <div className="flex gap-2 pt-2 border-t border-gray-100">
                            {report.visibility !== 'sent' ? (
                              <button onClick={() => setShowSendConfirm(report._id)}
                                disabled={visibilityLoading === report._id}
                                className="flex-1 py-2 bg-green-600 text-white text-xs rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">
                                {visibilityLoading === report._id ? '...' : '📤 Send to Committee'}
                              </button>
                            ) : (
                              <button onClick={() => handleVisibility(report._id, 'draft')}
                                disabled={visibilityLoading === report._id}
                                className="flex-1 py-2 bg-gray-200 text-gray-700 text-xs rounded-lg font-medium hover:bg-gray-300 disabled:opacity-50">
                                {visibilityLoading === report._id ? '...' : '↩️ Move to Draft'}
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ LOCATION PICKER MODAL ══ */}
      {showLocationPicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">📍 Select Report Location</h3>
              <p className="text-sm text-gray-500 mt-0.5">Click on the map where the issue is happening</p>
            </div>

            <div ref={locationMapContainer} className="w-full h-96" />

            {reportLocation && (
              <div className="p-4 bg-green-50 border-t border-green-200">
                <p className="text-sm font-medium text-green-800 mb-1">✅ Location Selected</p>
                <p className="text-xs text-green-600">{locationName}</p>
              </div>
            )}

            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => {
                  setShowLocationPicker(false)
                  if (!reportLocation) {
                    setLocationName('')
                  }
                }}
                className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl text-gray-600 font-medium hover:border-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowLocationPicker(false)}
                disabled={!reportLocation}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                Confirm Location
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ SEND CONFIRMATION MODAL ══ */}
      {showSendConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6">
              <div className="text-center mb-4">
                <div className="text-5xl mb-3">📤</div>
                <h3 className="text-lg font-bold text-gray-800">Send Report to Committee?</h3>
                <p className="text-sm text-gray-600 mt-2">
                  This report will be visible to committee members in <strong>{ngoZone}</strong> at <strong>{ngoName}</strong>. 
                  They will review and decide on actions.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4">
                <p className="text-xs text-blue-800">
                  💡 <strong>Tip:</strong> Make sure all details are accurate before sending. 
                  You can move it back to draft later if needed.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowSendConfirm(null)}
                  className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl text-gray-600 font-medium hover:border-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSendToCommittee(showSendConfirm)}
                  disabled={visibilityLoading === showSendConfirm}
                  className="flex-1 py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {visibilityLoading === showSendConfirm ? 'Sending...' : '✅ Confirm & Send'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}