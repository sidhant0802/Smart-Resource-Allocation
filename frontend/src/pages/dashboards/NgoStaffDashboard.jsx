import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { uploadApi, chatApi } from '../../api/authApi'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

const SEVERITY_CONFIG = {
  critical: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-l-red-500', label: '🔴 CRITICAL', bar: 'bg-red-500', score: 'text-red-600' },
  high: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-l-orange-500', label: '🟠 HIGH', bar: 'bg-orange-500', score: 'text-orange-600' },
  medium: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-l-yellow-500', label: '🟡 MEDIUM', bar: 'bg-yellow-500', score: 'text-yellow-600' },
  low: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-l-green-500', label: '🟢 LOW', bar: 'bg-green-500', score: 'text-green-600' },
  info: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-l-gray-300', label: '⚪ INFO', bar: 'bg-gray-400', score: 'text-gray-600' },
}

export default function NgoStaffDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState('upload')
  const [myReports, setMyReports] = useState([])
  const [loadingReports, setLoadingReports] = useState(false)

  // Profile
  const [staffProfile, setStaffProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)

  // NGO Applications
  const [myApplications, setMyApplications] = useState([])
  const [allNgos, setAllNgos] = useState([])
  const [loadingApplications, setLoadingApplications] = useState(false)
  const [loadingAllNgos, setLoadingAllNgos] = useState(false)
  const [applyLoading, setApplyLoading] = useState(null)
  const [applyMessage, setApplyMessage] = useState('')
  const [showApplyModal, setShowApplyModal] = useState(null)

  // Upload form
  const [uploadType, setUploadType] = useState(null)
  const [file, setFile] = useState(null)
  const [textInput, setTextInput] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadedReportId, setUploadedReportId] = useState(null)
  const [polledReport, setPolledReport] = useState(null)
  const [polling, setPolling] = useState(false)

  // Location
  const [reportLocation, setReportLocation] = useState(null)
  const [locationName, setLocationName] = useState('')
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [locationSearch, setLocationSearch] = useState('')
  const [locationSuggestions, setLocationSuggestions] = useState([])

  // NGO Selection for upload
  const [nearbyNgos, setNearbyNgos] = useState([])
  const [selectedNgo, setSelectedNgo] = useState(null)
  const [ngoZones, setNgoZones] = useState([])
  const [selectedZone, setSelectedZone] = useState(null)
  const [loadingNgos, setLoadingNgos] = useState(false)
  const [useCustomNgo, setUseCustomNgo] = useState(false)

  // Voice
  const [recording, setRecording] = useState(false)
  const [voiceText, setVoiceText] = useState('')
  const recognitionRef = useRef(null)

  // Visibility
  const [visibilityLoading, setVisibilityLoading] = useState(null)
  const [showSendConfirm, setShowSendConfirm] = useState(null)

  // Chat
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const chatEndRef = useRef(null)

  // Maps
  const locationMapContainer = useRef(null)
  const locationMap = useRef(null)
  const locationMarker = useRef(null)
  const reportsMapContainer = useRef(null)
  const reportsMap = useRef(null)

  const [successMsg, setSuccessMsg] = useState(null)
  const showSuccess = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 3000) }

  // ═══════════════════════════════════════
  // DERIVED: Only show approved NGO name near user name
  // ═══════════════════════════════════════
  const approvedNgoForUser = (() => {
    // Check if the user's primary NGO application is approved
    // First check from myApplications if loaded
    if (myApplications.length > 0) {
      const primaryNgoApp = myApplications.find(
        app => app.ngo?._id === user?.ngo?._id && app.status === 'approved'
      )
      if (primaryNgoApp) {
        return user?.ngo?.name || null
      }
      // If no matching approved application found for primary NGO, don't show it
      return null
    }
    // If applications haven't loaded yet, check from staffProfile
    if (staffProfile?.approvedNgos?.length > 0) {
      const isPrimaryApproved = staffProfile.approvedNgos.some(
        ngo => ngo._id === user?.ngo?._id || ngo._id === user?.ngo
      )
      if (isPrimaryApproved) return staffProfile.approvedNgos.find(
        ngo => ngo._id === user?.ngo?._id || ngo._id === user?.ngo
      )?.name
    }
    // Fallback: if user has ngo set and status is active, it's likely approved
    // We'll fetch applications on mount to be sure
    return null
  })()

  // Fetch applications on mount to determine approved status
  useEffect(() => {
    fetchMyApplications()
  }, [])

  useEffect(() => {
    if (activeTab === 'reports') fetchMyReports()
    if (activeTab === 'profile') fetchStaffProfile()
    if (activeTab === 'my-ngos') { fetchMyApplications(); fetchAllNgos() }
  }, [activeTab])

  // Location picker map
  useEffect(() => {
    if (!showLocationPicker || !locationMapContainer.current || locationMap.current) return
    setTimeout(() => {
      const userLoc = user?.coordinates ? [user.coordinates.lng, user.coordinates.lat] : [77.2090, 28.6139]
      locationMap.current = new mapboxgl.Map({
        container: locationMapContainer.current, style: 'mapbox://styles/mapbox/streets-v12', center: userLoc, zoom: 12,
      })
      locationMap.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
      locationMap.current.on('click', async (e) => {
        const { lng, lat } = e.lngLat
        if (locationMarker.current) locationMarker.current.remove()
        locationMarker.current = new mapboxgl.Marker({ color: '#3B82F6', draggable: true }).setLngLat([lng, lat]).addTo(locationMap.current)
        locationMap.current.flyTo({ center: [lng, lat], zoom: 14 })
        try {
          const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxgl.accessToken}&language=en`)
          const data = await res.json()
          const placeName = data.features?.[0]?.place_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
          setReportLocation({ latitude: lat, longitude: lng }); setLocationName(placeName); setLocationSearch(placeName)
        } catch { setReportLocation({ latitude: lat, longitude: lng }); setLocationName(`${lat.toFixed(4)}, ${lng.toFixed(4)}`) }
        locationMarker.current.on('dragend', async () => {
          const lngLat = locationMarker.current.getLngLat()
          try {
            const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lngLat.lng},${lngLat.lat}.json?access_token=${mapboxgl.accessToken}`)
            const data = await res.json()
            const placeName = data.features?.[0]?.place_name || `${lngLat.lat.toFixed(4)}, ${lngLat.lng.toFixed(4)}`
            setReportLocation({ latitude: lngLat.lat, longitude: lngLat.lng }); setLocationName(placeName); setLocationSearch(placeName)
          } catch { setReportLocation({ latitude: lngLat.lat, longitude: lngLat.lng }) }
        })
      })
    }, 300)
    return () => { if (locationMap.current) { locationMap.current.remove(); locationMap.current = null; locationMarker.current = null } }
  }, [showLocationPicker])

  // Reports map
  useEffect(() => {
    if (activeTab !== 'reports' || !reportsMapContainer.current || reportsMap.current || myReports.length === 0) return
    const reportsWithLocation = myReports.filter(r => r.latitude && r.longitude)
    if (reportsWithLocation.length === 0) return
    reportsMap.current = new mapboxgl.Map({
      container: reportsMapContainer.current, style: 'mapbox://styles/mapbox/light-v11',
      center: user?.coordinates ? [user.coordinates.lng, user.coordinates.lat] : [77.2090, 28.6139], zoom: 10,
    })
    reportsMap.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
    const bounds = new mapboxgl.LngLatBounds()
    reportsWithLocation.forEach(report => {
      const severity = report.analysis?.severityLevel || 'info'
      const markerColor = { critical: '#EF4444', high: '#F59E0B', medium: '#FBBF24', low: '#10B981', info: '#6B7280' }[severity] || '#6B7280'
      new mapboxgl.Marker({ color: markerColor }).setLngLat([report.longitude, report.latitude])
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`<div style="padding:10px;"><h3 style="font-weight:bold;font-size:14px;">${report.title}</h3><p style="font-size:11px;color:#666;">${SEVERITY_CONFIG[severity]?.label} • ${report.analysis?.urgencyScore || 0}/100</p></div>`))
        .addTo(reportsMap.current)
      bounds.extend([report.longitude, report.latitude])
    })
    if (reportsWithLocation.length > 1) reportsMap.current.fitBounds(bounds, { padding: 60, maxZoom: 12 })
    return () => { if (reportsMap.current) { reportsMap.current.remove(); reportsMap.current = null } }
  }, [activeTab, myReports])

  useEffect(() => {
    if (reportLocation && useCustomNgo) fetchNearbyNgos()
  }, [reportLocation, useCustomNgo])

  // ═══════════════════════════════════════
  // DATA FETCHERS
  // ═══════════════════════════════════════

  const fetchMyReports = async () => {
    setLoadingReports(true)
    try { const res = await uploadApi.getMyReports(); setMyReports(res.reports || []) }
    catch (err) { console.error(err) }
    finally { setLoadingReports(false) }
  }

  const fetchStaffProfile = async () => {
    setProfileLoading(true)
    try { const res = await uploadApi.getStaffProfile(); setStaffProfile(res) }
    catch (err) { console.error(err) }
    finally { setProfileLoading(false) }
  }

  const fetchMyApplications = async () => {
    setLoadingApplications(true)
    try { const res = await uploadApi.getMyApplications(); setMyApplications(res.data || []) }
    catch (err) { console.error(err) }
    finally { setLoadingApplications(false) }
  }

  const fetchAllNgos = async () => {
    setLoadingAllNgos(true)
    try {
      const params = {}
      if (user?.coordinates) { params.latitude = user.coordinates.lat; params.longitude = user.coordinates.lng }
      const res = await uploadApi.getNearbyNgos(params)
      setAllNgos(res.ngos || [])
    } catch (err) { console.error(err) }
    finally { setLoadingAllNgos(false) }
  }

  const fetchNearbyNgos = async () => {
    if (!reportLocation) return
    setLoadingNgos(true)
    try {
      const res = await uploadApi.getNearbyNgos({ latitude: reportLocation.latitude, longitude: reportLocation.longitude, radius: 50000 })
      setNearbyNgos(res.ngos || [])
    } catch (err) { console.error(err) }
    finally { setLoadingNgos(false) }
  }

  const fetchNgoZones = async (ngoId) => {
    try { const res = await uploadApi.getNgoZones(ngoId); setNgoZones(res.zones || []) }
    catch { setNgoZones([]) }
  }

  // ═══════════════════════════════════════
  // NGO APPLICATION HANDLERS
  // ═══════════════════════════════════════

  const handleApplyToNgo = async (ngoId) => {
    setApplyLoading(ngoId)
    try {
      const res = await uploadApi.applyToNgo({ ngoId, message: applyMessage })
      if (res.success) {
        showSuccess(res.message || 'Application submitted!')
        setShowApplyModal(null)
        setApplyMessage('')
        await fetchMyApplications()
        await fetchAllNgos()
      }
    } catch (err) {
      alert('❌ ' + err.message)
    } finally {
      setApplyLoading(null)
    }
  }

  // ═══════════════════════════════════════
  // UPLOAD HANDLERS
  // ═══════════════════════════════════════

  const handleSelectNgo = (ngo) => { setSelectedNgo(ngo); setSelectedZone(null); setNgoZones([]); fetchNgoZones(ngo._id) }

  const handleLocationSearch = async (query) => {
    setLocationSearch(query)
    if (query.length < 3) { setLocationSuggestions([]); return }
    try {
      const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxgl.accessToken}&limit=5&country=in`)
      const data = await res.json(); setLocationSuggestions(data.features || [])
    } catch { }
  }

  const handleSelectLocationSuggestion = (feature) => {
    const [lng, lat] = feature.center
    setReportLocation({ latitude: lat, longitude: lng }); setLocationName(feature.place_name); setLocationSearch(feature.place_name); setLocationSuggestions([])
    if (locationMap.current) {
      if (locationMarker.current) locationMarker.current.remove()
      locationMarker.current = new mapboxgl.Marker({ color: '#3B82F6', draggable: true }).setLngLat([lng, lat]).addTo(locationMap.current)
      locationMap.current.flyTo({ center: [lng, lat], zoom: 14 })
    }
  }

  const handleGetLiveLocation = () => {
    if (!navigator.geolocation) return alert('Geolocation not supported')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        setReportLocation({ latitude, longitude })
        try {
          const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${mapboxgl.accessToken}`)
          const data = await res.json()
          const name = data.features?.[0]?.place_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
          setLocationName(name); setLocationSearch(name)
        } catch { setLocationName(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`) }
        if (locationMap.current) {
          if (locationMarker.current) locationMarker.current.remove()
          locationMarker.current = new mapboxgl.Marker({ color: '#3B82F6' }).setLngLat([longitude, latitude]).addTo(locationMap.current)
          locationMap.current.flyTo({ center: [longitude, latitude], zoom: 14 })
        }
      },
      (err) => alert('Location error: ' + err.message), { enableHighAccuracy: true }
    )
  }

  const pollStatus = (reportId) => {
    setPolling(true); let attempts = 0
    const interval = setInterval(async () => {
      attempts++
      try { const res = await uploadApi.getStatus(reportId); if (res.report.status === 'analyzed') { clearInterval(interval); setPolling(false); setPolledReport(res.report); setShowChat(true); setChatMessages([]) } } catch { }
      if (attempts >= 30) { clearInterval(interval); setPolling(false) }
    }, 2000)
  }

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !polledReport) return
    const userMsg = chatInput.trim(); setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]); setChatLoading(true)
    try {
      const res = await chatApi.sendMessage({ reportId: polledReport._id, message: userMsg })
      setChatMessages(prev => [...prev, { role: 'assistant', content: res.message, recommendation: res.recommendation, confidence: res.confidence }])
    } catch { setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, AI unavailable.' }]) }
    finally { setChatLoading(false); chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }
  }

  const handleUpload = async () => {
    if (!uploadType) return alert('Select upload type')
    if (!title.trim()) return alert('Enter a title')
    if (!reportLocation) return alert('Select report location')
    const formData = new FormData()
    formData.append('title', title); formData.append('visibility', 'draft')
    formData.append('latitude', reportLocation.latitude); formData.append('longitude', reportLocation.longitude); formData.append('locationName', locationName)
    if (useCustomNgo && selectedNgo) { formData.append('ngoId', selectedNgo._id); if (selectedZone) formData.append('zoneId', selectedZone._id) }
    if (uploadType === 'text') { if (!textInput.trim()) return alert('Enter text'); formData.append('description', textInput) }
    else if (uploadType === 'voice') { if (!voiceText.trim()) return alert('Record voice'); formData.append('voiceText', voiceText); formData.append('description', voiceText) }
    else { if (!file) return alert('Select file'); formData.append('file', file); if (description) formData.append('description', description) }
    setUploading(true); setPolledReport(null); setShowChat(false); setChatMessages([])
    try { const res = await uploadApi.uploadFile(formData); setUploadedReportId(res.reportId); setUploading(false); pollStatus(res.reportId) }
    catch (err) { setUploading(false); alert('Upload failed: ' + err.message) }
  }

  const handleSendToCommittee = async (reportId) => {
    setVisibilityLoading(reportId)
    try {
      await uploadApi.updateVisibility(reportId, 'sent')
      if (polledReport?._id === reportId) setPolledReport(prev => ({ ...prev, visibility: 'sent' }))
      if (activeTab === 'reports') fetchMyReports()
      setShowSendConfirm(null); showSuccess('Report sent to committee!')
    } catch (err) { alert('Failed: ' + err.message) }
    finally { setVisibilityLoading(null) }
  }

  const handleVisibility = async (reportId, visibility) => {
    setVisibilityLoading(reportId)
    try {
      await uploadApi.updateVisibility(reportId, visibility)
      if (polledReport?._id === reportId) setPolledReport(prev => ({ ...prev, visibility }))
      if (activeTab === 'reports') fetchMyReports()
    } catch (err) { alert('Failed: ' + err.message) }
    finally { setVisibilityLoading(null) }
  }

  const startRecording = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return alert('Use Chrome')
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR(); rec.continuous = true; rec.interimResults = true; rec.lang = 'en-IN'
    rec.onresult = (e) => { let t = ''; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; setVoiceText(t) }
    rec.onend = () => setRecording(false); rec.start(); recognitionRef.current = rec; setRecording(true)
  }
  const stopRecording = () => { recognitionRef.current?.stop(); setRecording(false) }

  const resetForm = () => {
    setUploadType(null); setFile(null); setTextInput(''); setVoiceText(''); setTitle(''); setDescription('')
    setPolledReport(null); setUploadedReportId(null); setShowChat(false); setChatMessages([])
    setReportLocation(null); setLocationName(''); setShowLocationPicker(false); setLocationSearch('')
    setSelectedNgo(null); setSelectedZone(null); setNgoZones([]); setUseCustomNgo(false)
  }

  const handleLogout = () => { logout(); navigate('/login') }
  const sev = (l) => SEVERITY_CONFIG[l] || SEVERITY_CONFIG.info
  const ngoZone = user?.zone?.name || 'Unassigned Zone'

  // Count pending applications
  const pendingCount = myApplications.filter(a => a.status === 'pending').length
  const approvedCount = myApplications.filter(a => a.status === 'approved').length

  // ═══════════════════════════════════════
  // Get the APPROVED NGO name to display near user name
  // Only show NGO badge if the user's primary NGO application is approved
  // ═══════════════════════════════════════
  const getApprovedNgoName = () => {
    // If applications are loaded, check if primary NGO is approved
    if (myApplications.length > 0) {
      const primaryApproved = myApplications.find(
        app => {
          const appNgoId = app.ngo?._id || app.ngo
          const userNgoId = user?.ngo?._id || user?.ngo
          return appNgoId === userNgoId && app.status === 'approved'
        }
      )
      if (primaryApproved) return primaryApproved.ngo?.name || user?.ngo?.name
    }

    // If staffProfile loaded, check approvedNgos
    if (staffProfile?.approvedNgos?.length > 0) {
      const userNgoId = user?.ngo?._id || user?.ngo
      const found = staffProfile.approvedNgos.find(n => n._id === userNgoId)
      if (found) return found.name
    }

    // If user has isApproved flag or similar on user object
    if (user?.ngoApproved === true || user?.ngoStatus === 'approved') {
      return user?.ngo?.name
    }

    return null
  }

  const approvedNgoName = getApprovedNgoName()

  // Get ALL approved NGO names for the navbar badge
  const getAllApprovedNgoNames = () => {
    const names = []
    if (myApplications.length > 0) {
      myApplications
        .filter(app => app.status === 'approved')
        .forEach(app => {
          const name = app.ngo?.name
          if (name) names.push(name)
        })
    } else if (staffProfile?.approvedNgos?.length > 0) {
      staffProfile.approvedNgos.forEach(n => {
        if (n.name) names.push(n.name)
      })
    }
    return names
  }

  const allApprovedNgoNames = getAllApprovedNgoNames()

  const tabs = [
    { key: 'upload', label: '📤 New Report' },
    { key: 'reports', label: '📋 My Reports', badge: myReports.length },
    { key: 'my-ngos', label: '🏢 My NGOs', badge: pendingCount },
    { key: 'profile', label: '👤 Profile' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📋</span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-gray-800">NGO Field Staff</h1>
                {/* Only show approved NGO badge */}
                {allApprovedNgoNames.length > 0 && (
                  <div className="hidden sm:flex items-center gap-1">
                    {allApprovedNgoNames.map((name, idx) => (
                      <span
                        key={idx}
                        className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium border border-green-200"
                      >
                        ✅ {name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500">{user?.fullName}</p>
            </div>

            {/* Show approved NGO detail card - only if approved */}
            {approvedNgoName && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-lg border border-green-200 ml-3">
                <span>🏢</span>
                <div>
                  <p className="text-xs text-green-700 font-semibold">{approvedNgoName}</p>
                  <p className="text-xs text-green-600">📍 {ngoZone}</p>
                </div>
                <span className="text-xs bg-green-200 text-green-800 px-1.5 py-0.5 rounded-full font-bold">✅</span>
              </div>
            )}

            {/* If NOT approved, show pending/no NGO status */}
            {!approvedNgoName && user?.ngo?.name && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-yellow-50 rounded-lg border border-yellow-200 ml-3">
                <span>🏢</span>
                <div>
                  <p className="text-xs text-yellow-700 font-semibold">{user.ngo.name}</p>
                  <p className="text-xs text-yellow-600">⏳ Pending Approval</p>
                </div>
              </div>
            )}

            {!approvedNgoName && !user?.ngo?.name && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200 ml-3">
                <span>🏢</span>
                <p className="text-xs text-gray-500 font-medium">No NGO assigned</p>
              </div>
            )}
          </div>
          <button onClick={handleLogout} className="text-sm bg-red-50 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 font-medium">Logout</button>
        </div>
      </nav>

      {successMsg && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-3 m-4 rounded text-sm animate-pulse">✅ {successMsg}</div>
      )}

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-4 py-3 text-sm font-medium flex items-center gap-2 whitespace-nowrap border-b-2 ${
                activeTab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
              {t.badge > 0 && <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{t.badge}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 sm:p-6">

        {/* ══════ UPLOAD TAB ══════ */}
        {activeTab === 'upload' && (
          <div className="space-y-5">
            {/* AI Result */}
            {polledReport && (
              <div className={`rounded-2xl border-2 overflow-hidden ${sev(polledReport.analysis?.severityLevel).border.replace('border-l-', 'border-')}`}>
                <div className={`p-4 ${sev(polledReport.analysis?.severityLevel).bg} flex items-center justify-between`}>
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg">🤖 AI Analysis Complete</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Model: {polledReport.analysis?.model || 'gemini'}</p>
                  </div>
                  <button onClick={resetForm} className="text-xs text-gray-500 bg-white px-3 py-1.5 rounded-lg border">New Report</button>
                </div>
                <div className="bg-white p-5 space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-500">Urgency</p>
                      <p className={`text-3xl font-bold mt-1 ${sev(polledReport.analysis?.severityLevel).score}`}>{polledReport.analysis?.urgencyScore || 0}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-500">Severity</p>
                      <p className={`text-sm font-bold mt-2 ${sev(polledReport.analysis?.severityLevel).text}`}>{sev(polledReport.analysis?.severityLevel).label}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-500">Category</p>
                      <p className="text-sm font-bold mt-2 text-gray-800">{polledReport.analysis?.category || '—'}</p>
                    </div>
                  </div>
                  {polledReport.analysis?.summary && (
                    <div className={`rounded-xl p-4 ${sev(polledReport.analysis?.severityLevel).bg}`}>
                      <p className="text-xs font-semibold text-gray-600 mb-1">🤖 AI Summary</p>
                      <p className="text-sm text-gray-800 leading-relaxed">{polledReport.analysis.summary}</p>
                    </div>
                  )}
                  {polledReport.analysis?.keyProblems?.length > 0 && (
                    <div><p className="text-xs font-semibold text-gray-600 mb-2">🔍 Key Problems</p>
                      <ul className="space-y-1">{polledReport.analysis.keyProblems.map((p, i) => <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><span className="text-red-500">•</span>{p}</li>)}</ul>
                    </div>
                  )}
                  {polledReport.analysis?.suggestedActions?.length > 0 && (
                    <div><p className="text-xs font-semibold text-gray-600 mb-2">✅ Suggested Actions</p>
                      <ul className="space-y-1">{polledReport.analysis.suggestedActions.map((a, i) => <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><span className="text-green-500">→</span>{a}</li>)}</ul>
                    </div>
                  )}
                  <div className="border-t border-gray-100 pt-4">
                    {polledReport.visibility !== 'sent' ? (
                      <div className="space-y-3">
                        <button onClick={() => setShowSendConfirm(polledReport._id)} className="w-full py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2">📤 Send to Committee</button>
                        <button onClick={() => handleVisibility(polledReport._id, 'draft')} className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm">📝 Keep as Draft</button>
                      </div>
                    ) : (
                      <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4 text-center">
                        <div className="text-4xl mb-2">✅</div><p className="text-green-800 font-bold">Report Submitted!</p>
                      </div>
                    )}
                  </div>
                  {/* Chat */}
                  <div className="border-t border-gray-100 pt-4">
                    <button onClick={() => setShowChat(!showChat)} className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 hover:bg-indigo-100 rounded-xl">
                      <span className="font-semibold text-indigo-700 text-sm">🤖 Ask AI about this report</span>
                      <span className="text-indigo-500 text-xs">{showChat ? '▲' : '▼'}</span>
                    </button>
                    {showChat && (
                      <div className="mt-3 border border-indigo-100 rounded-xl overflow-hidden">
                        <div className="h-64 overflow-y-auto p-4 space-y-3 bg-gray-50">
                          {chatMessages.length === 0 && <div className="text-center text-gray-400 text-sm mt-8"><p className="text-2xl mb-2">💬</p><p>Ask anything about this report</p></div>}
                          {chatMessages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-xs px-4 py-2.5 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white text-gray-800 border rounded-bl-sm shadow-sm'}`}>
                                <p>{msg.content}</p>
                              </div>
                            </div>
                          ))}
                          {chatLoading && <div className="flex justify-start"><div className="bg-white border rounded-2xl px-4 py-3 shadow-sm"><div className="flex gap-1"><span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" /><span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} /><span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} /></div></div></div>}
                          <div ref={chatEndRef} />
                        </div>
                        <div className="flex gap-2 p-3 bg-white border-t">
                          <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChatMessage()} placeholder="Ask..." disabled={chatLoading} className="flex-1 px-3 py-2 text-sm border rounded-xl disabled:opacity-50" />
                          <button onClick={sendChatMessage} disabled={chatLoading || !chatInput.trim()} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-xl disabled:opacity-50 font-medium">Send</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {polling && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-8 text-center">
                <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
                <p className="font-bold text-blue-800 text-lg">🤖 Gemini AI Analyzing...</p>
              </div>
            )}

            {!polledReport && !polling && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Report Title *</label>
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Brief title" className="w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Report Location *</label>
                  {!reportLocation ? (
                    <div className="space-y-2">
                      <button onClick={handleGetLiveLocation} className="w-full py-3 bg-green-50 border-2 border-green-300 rounded-xl text-green-700 font-medium text-sm">📡 Use Live Location</button>
                      <button onClick={() => setShowLocationPicker(true)} className="w-full py-3 border-2 border-dashed border-blue-300 rounded-xl text-blue-600 font-medium text-sm">📍 Select on Map</button>
                    </div>
                  ) : (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-start justify-between">
                      <div className="flex items-center gap-2"><span className="text-green-500 text-xl">✅</span><div><p className="text-sm font-medium text-green-800">Location Selected</p><p className="text-xs text-green-600">{locationName}</p></div></div>
                      <button onClick={() => { setReportLocation(null); setLocationName(''); setShowLocationPicker(true) }} className="text-xs text-green-700 hover:underline">Change</button>
                    </div>
                  )}
                </div>
                {reportLocation && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Submit To</label>
                    <div className="flex gap-2 mb-3">
                      <button onClick={() => { setUseCustomNgo(false); setSelectedNgo(null) }} className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 ${!useCustomNgo ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}>🏢 My NGO</button>
                      <button onClick={() => setUseCustomNgo(true)} className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 ${useCustomNgo ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}>🔍 Other NGO</button>
                    </div>
                    {useCustomNgo && (
                      <div className="space-y-3">
                        {loadingNgos ? <div className="text-center py-4"><div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" /></div> :
                          nearbyNgos.length === 0 ? <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center"><p className="text-yellow-700 text-sm">No NGOs found nearby</p></div> :
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {nearbyNgos.map(ngo => (
                                <button key={ngo._id} onClick={() => {
                                  if (ngo.applicationStatus === 'approved' || ngo.isMyNgo) handleSelectNgo(ngo)
                                  else if (ngo.applicationStatus === 'pending') alert('Application pending approval')
                                  else setShowApplyModal(ngo)
                                }}
                                  className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                                    selectedNgo?._id === ngo._id ? 'border-blue-500 bg-blue-50' :
                                    ngo.applicationStatus === 'approved' || ngo.isMyNgo ? 'border-green-200 hover:border-green-400' :
                                    ngo.applicationStatus === 'pending' ? 'border-yellow-200' :
                                    'border-gray-200 hover:border-blue-200'
                                  }`}>
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="font-medium text-sm text-gray-800">{ngo.name}</p>
                                      {ngo.locationName && <p className="text-xs text-gray-500">📍 {ngo.locationName}</p>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {ngo.distance != null && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{ngo.distance}km</span>}
                                      {ngo.isMyNgo && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">My NGO</span>}
                                      {ngo.applicationStatus === 'approved' && !ngo.isMyNgo && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✅ Approved</span>}
                                      {ngo.applicationStatus === 'pending' && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full animate-pulse">⏳ Pending</span>}
                                      {ngo.applicationStatus === 'rejected' && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">❌ Rejected</span>}
                                      {!ngo.applicationStatus && !ngo.isMyNgo && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">Apply →</span>}
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                        }
                        {selectedNgo && ngoZones.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-gray-600 mb-2">Select Zone</p>
                            <div className="flex flex-wrap gap-2">
                              {ngoZones.map(zone => (
                                <button key={zone._id} onClick={() => setSelectedZone(zone)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${selectedZone?._id === zone._id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}>📍 {zone.name}</button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {!useCustomNgo && (
                      approvedNgoName ? (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
                          <span>🏢</span>
                          <div>
                            <p className="text-xs font-semibold text-green-700">{approvedNgoName}</p>
                            <p className="text-xs text-green-600">Zone: {ngoZone}</p>
                          </div>
                          <span className="text-xs bg-green-200 text-green-800 px-1.5 py-0.5 rounded-full font-bold ml-auto">✅ Approved</span>
                        </div>
                      ) : user?.ngo?.name ? (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-center gap-2">
                          <span>🏢</span>
                          <div>
                            <p className="text-xs font-semibold text-yellow-700">{user.ngo.name}</p>
                            <p className="text-xs text-yellow-600">⏳ Awaiting approval to submit reports</p>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                          <span>⚠️</span>
                          <p className="text-xs text-red-700 font-medium">No NGO assigned. Apply to an NGO first.</p>
                        </div>
                      )
                    )}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Upload Type *</label>
                  <div className="grid grid-cols-4 gap-3">
                    {[{ type: 'pdf', icon: '📄', label: 'PDF' }, { type: 'image', icon: '🖼️', label: 'Image' }, { type: 'voice', icon: '🎤', label: 'Voice' }, { type: 'text', icon: '✏️', label: 'Text' }].map(opt => (
                      <button key={opt.type} onClick={() => setUploadType(opt.type)} className={`p-4 rounded-xl border-2 text-center ${uploadType === opt.type ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                        <div className="text-3xl mb-1">{opt.icon}</div><p className="text-xs font-medium text-gray-700">{opt.label}</p>
                      </button>
                    ))}
                  </div>
                </div>
                {uploadType === 'pdf' && <div><input type="file" accept=".pdf" onChange={e => setFile(e.target.files[0])} className="w-full px-4 py-3 border rounded-xl text-sm" />{file && <p className="text-xs text-green-600 mt-1">✅ {file.name}</p>}</div>}
                {uploadType === 'image' && <div><input type="file" accept="image/*" onChange={e => setFile(e.target.files[0])} className="w-full px-4 py-3 border rounded-xl text-sm" />{file && <img src={URL.createObjectURL(file)} className="mt-2 w-full h-40 object-cover rounded-xl border" />}<textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe image..." rows={3} className="mt-3 w-full px-4 py-3 border rounded-xl text-sm resize-none" /></div>}
                {uploadType === 'voice' && <div className="bg-gray-50 rounded-xl p-6 text-center"><button onClick={recording ? stopRecording : startRecording} className={`w-24 h-24 rounded-full text-4xl mx-auto block shadow-lg ${recording ? 'bg-red-500 text-white animate-pulse' : 'bg-blue-600 text-white'}`}>{recording ? '⏹️' : '🎤'}</button>{voiceText && <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-4"><p className="text-xs text-green-600 font-medium">✅ Transcribed:</p><p className="text-sm">{voiceText}</p></div>}</div>}
                {uploadType === 'text' && <div><textarea value={textInput} onChange={e => setTextInput(e.target.value)} placeholder="Describe the issue..." rows={8} className="w-full px-4 py-3 border rounded-xl text-sm resize-none" /><p className="text-xs text-gray-400 mt-1">{textInput.length} chars</p></div>}
                {uploadType && <button onClick={handleUpload} disabled={uploading} className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold disabled:opacity-60 flex items-center justify-center gap-2">{uploading ? <><div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" /> Uploading...</> : '🤖 Analyze with Gemini AI →'}</button>}
              </>
            )}
          </div>
        )}

        {/* ══════ REPORTS TAB ══════ */}
        {activeTab === 'reports' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">My Reports ({myReports.length})</h3>
              <button onClick={fetchMyReports} className="text-xs text-blue-600 hover:underline">🔄 Refresh</button>
            </div>
            {myReports.filter(r => r.latitude && r.longitude).length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border overflow-hidden mb-6">
                <div className="px-6 py-4 border-b"><h3 className="font-semibold text-gray-800">🗺️ Reports Map</h3></div>
                <div ref={reportsMapContainer} className="w-full h-80" />
              </div>
            )}
            {loadingReports ? <div className="text-center py-12"><div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" /></div> :
              myReports.length === 0 ? <div className="bg-white rounded-2xl p-12 text-center shadow-sm"><p className="text-5xl mb-3">📋</p><h3 className="text-lg font-semibold">No reports yet</h3><button onClick={() => setActiveTab('upload')} className="mt-4 bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium">➕ Create Report</button></div> :
                <div className="space-y-4">
                  {myReports.map(report => (
                    <div key={report._id} className={`bg-white rounded-2xl shadow-sm border-l-4 ${sev(report.analysis?.severityLevel).border} overflow-hidden hover:shadow-md`}>
                      <div className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-800">{report.title}</h4>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <p className="text-xs text-gray-400">{new Date(report.createdAt).toLocaleString()}</p>
                              {report.ngo?.name && <span className="text-xs text-blue-500">🏢 {report.ngo.name}</span>}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${sev(report.analysis?.severityLevel).bg} ${sev(report.analysis?.severityLevel).text}`}>{sev(report.analysis?.severityLevel).label}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${report.visibility === 'sent' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{report.visibility === 'sent' ? '✅ Sent' : '📝 Draft'}</span>
                          </div>
                        </div>
                        {report.analysis?.summary && <p className="text-xs text-gray-600 mb-3 line-clamp-2">{report.analysis.summary}</p>}
                        <div className="flex gap-2 pt-2 border-t border-gray-100">
                          {report.visibility !== 'sent' ?
                            <button onClick={() => setShowSendConfirm(report._id)} className="flex-1 py-2 bg-green-600 text-white text-xs rounded-lg font-medium">📤 Send</button> :
                            <button onClick={() => handleVisibility(report._id, 'draft')} className="flex-1 py-2 bg-gray-200 text-gray-700 text-xs rounded-lg font-medium">↩️ Draft</button>
                          }
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>
        )}

        {/* ══════ MY NGOS TAB ══════ */}
        {activeTab === 'my-ngos' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-1">🏢 My NGO Connections</h2>
              <p className="text-sm text-gray-500">Apply to NGOs to submit reports to their zones</p>
            </div>

            {/* My Primary NGO - show approval status */}
            <div className={`rounded-2xl p-5 text-white ${
              approvedNgoName
                ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                : user?.ngo?.name
                  ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                  : 'bg-gradient-to-r from-gray-400 to-gray-500'
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center text-2xl">🏢</div>
                <div className="flex-1">
                  <p className="text-xs opacity-80">Primary NGO</p>
                  <h3 className="text-lg font-bold">{user?.ngo?.name || 'No NGO Assigned'}</h3>
                  {user?.ngo?.name && <p className="opacity-80 text-xs">📍 {ngoZone}</p>}
                </div>
                <span className="bg-white bg-opacity-20 text-white text-xs px-3 py-1 rounded-full font-medium">
                  {approvedNgoName ? '✅ Approved' : user?.ngo?.name ? '⏳ Pending' : '—'}
                </span>
              </div>
            </div>

            {/* My Applications */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">📋 My Applications ({myApplications.length})</h3>

              {loadingApplications ? (
                <div className="text-center py-8"><div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" /></div>
              ) : myApplications.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center shadow-sm border">
                  <p className="text-4xl mb-3">📬</p>
                  <p className="text-gray-500 text-sm">No applications yet. Apply to nearby NGOs below!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myApplications.map(app => (
                    <div key={app._id} className={`bg-white rounded-2xl p-4 shadow-sm border-l-4 ${
                      app.status === 'approved' ? 'border-l-green-500' :
                      app.status === 'pending' ? 'border-l-yellow-500' :
                      'border-l-red-500'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                            app.status === 'approved' ? 'bg-green-100' :
                            app.status === 'pending' ? 'bg-yellow-100' :
                            'bg-red-100'
                          }`}>
                            {app.status === 'approved' ? '✅' : app.status === 'pending' ? '⏳' : '❌'}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">{app.ngo?.name || 'Unknown NGO'}</p>
                            {app.ngo?.locationName && <p className="text-xs text-gray-500">📍 {app.ngo.locationName}</p>}
                            <p className="text-xs text-gray-400">Applied: {new Date(app.appliedAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs px-3 py-1 rounded-full font-bold ${
                            app.status === 'approved' ? 'bg-green-100 text-green-700' :
                            app.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {app.status === 'approved' ? '✅ Approved' :
                             app.status === 'pending' ? '⏳ Pending' :
                             '❌ Rejected'}
                          </span>
                          {app.status === 'approved' && (
                            <p className="text-xs text-green-600 mt-1">Can submit reports ✓</p>
                          )}
                          {app.reviewNote && (
                            <p className="text-xs text-gray-500 mt-1 italic">"{app.reviewNote}"</p>
                          )}
                        </div>
                      </div>
                      {app.message && (
                        <div className="mt-2 bg-gray-50 rounded-lg p-2">
                          <p className="text-xs text-gray-500">Your message: <span className="text-gray-700">{app.message}</span></p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Discover & Apply to NGOs */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">🔍 Discover Nearby NGOs</h3>
              <p className="text-xs text-gray-500 mb-4">Apply to submit reports to these organizations</p>

              {loadingAllNgos ? (
                <div className="text-center py-8"><div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" /></div>
              ) : allNgos.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center shadow-sm border">
                  <p className="text-4xl mb-3">🔍</p>
                  <p className="text-gray-500 text-sm">No NGOs found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {allNgos.filter(ngo => !ngo.isMyNgo).map(ngo => {
                    const hasApplied = ngo.applicationStatus
                    return (
                      <div key={ngo._id} className="bg-white rounded-2xl p-4 shadow-sm border hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-xl">🏢</div>
                            <div className="flex-1">
                              <p className="font-semibold text-gray-800">{ngo.name}</p>
                              {ngo.description && <p className="text-xs text-gray-500 line-clamp-1">{ngo.description}</p>}
                              {ngo.locationName && <p className="text-xs text-gray-400 mt-0.5">📍 {ngo.locationName}</p>}
                              {ngo.distance != null && <p className="text-xs text-blue-500 mt-0.5">📏 {ngo.distance}km away</p>}
                            </div>
                          </div>
                          <div>
                            {hasApplied === 'approved' ? (
                              <span className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-full font-bold">✅ Approved</span>
                            ) : hasApplied === 'pending' ? (
                              <span className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-full font-bold animate-pulse">⏳ Pending</span>
                            ) : hasApplied === 'rejected' ? (
                              <span className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-full font-bold">❌ Rejected</span>
                            ) : (
                              <button
                                onClick={() => setShowApplyModal(ngo)}
                                className="px-4 py-2 bg-blue-600 text-white text-xs rounded-lg font-medium hover:bg-blue-700"
                              >
                                📩 Apply
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-2xl p-5 border border-green-200">
              <h4 className="font-semibold text-gray-800 mb-2">📊 Summary</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{(user?.ngo ? 1 : 0) + approvedCount}</p>
                  <p className="text-xs text-gray-500">Total NGOs</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
                  <p className="text-xs text-gray-500">Pending</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{approvedCount}</p>
                  <p className="text-xs text-gray-500">Approved</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════ PROFILE TAB ══════ */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            {profileLoading ? <div className="text-center py-12"><div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" /></div> : (
              <>
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-6 text-white">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-3xl">📋</div>
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold">{staffProfile?.user?.fullName || user?.fullName}</h2>
                      <p className="text-blue-100 text-sm">{staffProfile?.user?.email || user?.email}</p>
                      <p className="text-blue-200 text-xs mt-1">📍 {staffProfile?.user?.locationName || user?.locationName || 'Not set'}</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { val: staffProfile?.stats?.totalReports || 0, label: 'Total', color: 'text-blue-600' },
                    { val: staffProfile?.stats?.sentReports || 0, label: 'Sent', color: 'text-green-600' },
                    { val: staffProfile?.stats?.draftReports || 0, label: 'Drafts', color: 'text-gray-600' },
                    { val: staffProfile?.stats?.severity?.critical || 0, label: 'Critical', color: 'text-red-600' },
                  ].map((s, i) => (
                    <div key={i} className="bg-white rounded-xl p-4 shadow-sm text-center border">
                      <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
                      <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Approved NGOs */}
                {staffProfile?.approvedNgos?.length > 0 && (
                  <div className="bg-white rounded-2xl p-5 shadow-sm border">
                    <h4 className="text-sm font-medium text-gray-600 mb-3">🏢 Approved NGOs (can submit reports to)</h4>
                    <div className="flex flex-wrap gap-2">
                      {staffProfile.approvedNgos.map(ngo => (
                        <span key={ngo._id} className="bg-green-100 text-green-700 px-3 py-1.5 rounded-full text-xs font-medium">✅ {ngo.name}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="bg-white rounded-2xl p-5 shadow-sm border">
                    <h4 className="text-sm font-medium text-gray-600 mb-3">Contact</h4>
                    <div className="space-y-2 text-sm">
                      <p><strong>Email:</strong> {staffProfile?.user?.email || user?.email}</p>
                      <p><strong>Phone:</strong> {staffProfile?.user?.phone || user?.phone || 'Not set'}</p>
                      <p><strong>Status:</strong> <span className="text-green-600 font-medium">{staffProfile?.user?.status || user?.status}</span></p>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl p-5 shadow-sm border">
                    <h4 className="text-sm font-medium text-gray-600 mb-3">Organization</h4>
                    <div className="space-y-2 text-sm">
                      <p>
                        <strong>Primary NGO:</strong> {staffProfile?.user?.ngo?.name || user?.ngo?.name || 'None'}
                        {approvedNgoName && <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✅</span>}
                        {!approvedNgoName && user?.ngo?.name && <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">⏳</span>}
                      </p>
                      <p><strong>Zone:</strong> {staffProfile?.user?.zone?.name || ngoZone}</p>
                      <p><strong>Joined:</strong> {new Date(user?.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ══ LOCATION PICKER MODAL ══ */}
      {showLocationPicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-6 border-b">
              <h3 className="text-lg font-bold text-gray-800">📍 Select Report Location</h3>
            </div>
            <div className="px-4 sm:px-6 pt-4 relative">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input type="text" value={locationSearch} onChange={e => handleLocationSearch(e.target.value)} placeholder="Search location..." className="w-full px-4 py-2.5 pl-10 border rounded-xl text-sm" />
                  <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
                </div>
                <button onClick={handleGetLiveLocation} className="px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium">📡</button>
              </div>
              {locationSuggestions.length > 0 && (
                <div className="absolute left-4 right-4 bg-white border rounded-xl mt-1 shadow-lg z-50 max-h-48 overflow-y-auto">
                  {locationSuggestions.map(f => (
                    <button key={f.id} onClick={() => handleSelectLocationSuggestion(f)} className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b text-sm">
                      <p className="font-medium text-gray-800">{f.text}</p><p className="text-xs text-gray-500">{f.place_name}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div ref={locationMapContainer} className="w-full h-80 sm:h-96 mt-3" />
            {reportLocation && <div className="p-4 bg-green-50 border-t border-green-200"><p className="text-sm font-medium text-green-800">✅ {locationName}</p></div>}
            <div className="p-4 sm:p-6 border-t flex gap-3">
              <button onClick={() => { setShowLocationPicker(false); if (!reportLocation) setLocationName('') }} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl text-gray-600 font-medium">Cancel</button>
              <button onClick={() => setShowLocationPicker(false)} disabled={!reportLocation} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-medium disabled:opacity-50">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ SEND CONFIRM MODAL ══ */}
      {showSendConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="text-center mb-4">
              <div className="text-5xl mb-3">📤</div>
              <h3 className="text-lg font-bold text-gray-800">Send to Committee?</h3>
              <p className="text-sm text-gray-600 mt-2">Committee will review and take action.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowSendConfirm(null)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl text-gray-600 font-medium">Cancel</button>
              <button onClick={() => handleSendToCommittee(showSendConfirm)} disabled={visibilityLoading === showSendConfirm} className="flex-1 py-2.5 bg-green-600 text-white rounded-xl font-medium disabled:opacity-50">
                {visibilityLoading === showSendConfirm ? 'Sending...' : '✅ Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ APPLY TO NGO MODAL ══ */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="text-center mb-4">
              <div className="text-5xl mb-3">📩</div>
              <h3 className="text-lg font-bold text-gray-800">Apply to {showApplyModal.name}</h3>
              <p className="text-sm text-gray-500 mt-1">Request access to submit reports to this NGO</p>
              {showApplyModal.locationName && (
                <p className="text-xs text-gray-400 mt-1">📍 {showApplyModal.locationName}</p>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Message (optional)</label>
              <textarea
                value={applyMessage}
                onChange={e => setApplyMessage(e.target.value)}
                placeholder="Why do you want to submit reports to this NGO? What area do you cover?"
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4">
              <p className="text-xs text-blue-800">
                💡 The NGO manager will review your application. Once approved, you can submit reports to their zones.
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setShowApplyModal(null); setApplyMessage('') }} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl text-gray-600 font-medium">
                Cancel
              </button>
              <button
                onClick={() => handleApplyToNgo(showApplyModal._id)}
                disabled={applyLoading === showApplyModal._id}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {applyLoading === showApplyModal._id ? '⏳ Applying...' : '📩 Submit Application'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}