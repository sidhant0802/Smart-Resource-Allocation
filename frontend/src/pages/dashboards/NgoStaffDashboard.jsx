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

  // Multiple NGO Selection
  const [selectedNgosForUpload, setSelectedNgosForUpload] = useState([])
  const [nearbyNgos, setNearbyNgos] = useState([])
  const [loadingNgos, setLoadingNgos] = useState(false)
  const [useCustomNgos, setUseCustomNgos] = useState(false)

  // Voice
  const [recording, setRecording] = useState(false)
  const [voiceText, setVoiceText] = useState('')
  const recognitionRef = useRef(null)

  // Visibility & Send
  const [visibilityLoading, setVisibilityLoading] = useState(null)
  const [showSendConfirm, setShowSendConfirm] = useState(null)
  const [showSendMultipleModal, setShowSendMultipleModal] = useState(null)
  const [selectedNgosForSend, setSelectedNgosForSend] = useState([])
  const [sendToNgosLoading, setSendToNgosLoading] = useState(false)

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
  const showSuccess = (msg) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 3500)
  }

  // ═══════════════════════════════════════
  // EFFECTS
  // ═══════════════════════════════════════

  useEffect(() => {
    fetchMyApplications()
  }, [])

  useEffect(() => {
    if (activeTab === 'reports') fetchMyReports()
    if (activeTab === 'profile') fetchStaffProfile()
    if (activeTab === 'my-ngos') {
      fetchMyApplications()
      fetchAllNgos()
    }
  }, [activeTab])

  // Location picker map
  useEffect(() => {
    if (!showLocationPicker || !locationMapContainer.current || locationMap.current) return
    setTimeout(() => {
      const userLoc = user?.coordinates
        ? [user.coordinates.lng, user.coordinates.lat]
        : [77.209, 28.6139]
      locationMap.current = new mapboxgl.Map({
        container: locationMapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: userLoc,
        zoom: 12,
      })
      locationMap.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
      locationMap.current.on('click', async (e) => {
        const { lng, lat } = e.lngLat
        if (locationMarker.current) locationMarker.current.remove()
        locationMarker.current = new mapboxgl.Marker({ color: '#3B82F6', draggable: true })
          .setLngLat([lng, lat])
          .addTo(locationMap.current)
        locationMap.current.flyTo({ center: [lng, lat], zoom: 14 })
        try {
          const res = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxgl.accessToken}&language=en`
          )
          const data = await res.json()
          const placeName = data.features?.[0]?.place_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
          setReportLocation({ latitude: lat, longitude: lng })
          setLocationName(placeName)
          setLocationSearch(placeName)
        } catch {
          setReportLocation({ latitude: lat, longitude: lng })
          setLocationName(`${lat.toFixed(4)}, ${lng.toFixed(4)}`)
        }
        locationMarker.current.on('dragend', async () => {
          const lngLat = locationMarker.current.getLngLat()
          try {
            const res = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${lngLat.lng},${lngLat.lat}.json?access_token=${mapboxgl.accessToken}`
            )
            const data = await res.json()
            const placeName = data.features?.[0]?.place_name || `${lngLat.lat.toFixed(4)}, ${lngLat.lng.toFixed(4)}`
            setReportLocation({ latitude: lngLat.lat, longitude: lngLat.lng })
            setLocationName(placeName)
            setLocationSearch(placeName)
          } catch {
            setReportLocation({ latitude: lngLat.lat, longitude: lngLat.lng })
          }
        })
      })
    }, 300)
    return () => {
      if (locationMap.current) {
        locationMap.current.remove()
        locationMap.current = null
        locationMarker.current = null
      }
    }
  }, [showLocationPicker])

  // Reports map
  useEffect(() => {
    if (
      activeTab !== 'reports' ||
      !reportsMapContainer.current ||
      reportsMap.current ||
      myReports.length === 0
    ) return
    const reportsWithLocation = myReports.filter((r) => r.latitude && r.longitude)
    if (reportsWithLocation.length === 0) return
    reportsMap.current = new mapboxgl.Map({
      container: reportsMapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: user?.coordinates
        ? [user.coordinates.lng, user.coordinates.lat]
        : [77.209, 28.6139],
      zoom: 10,
    })
    reportsMap.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
    const bounds = new mapboxgl.LngLatBounds()
    reportsWithLocation.forEach((report) => {
      const severity = report.analysis?.severityLevel || 'info'
      const markerColor =
        { critical: '#EF4444', high: '#F59E0B', medium: '#FBBF24', low: '#10B981', info: '#6B7280' }[severity] || '#6B7280'
      new mapboxgl.Marker({ color: markerColor })
        .setLngLat([report.longitude, report.latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<div style="padding:10px;"><h3 style="font-weight:bold;font-size:14px;">${report.title}</h3><p style="font-size:11px;color:#666;">${SEVERITY_CONFIG[severity]?.label} • ${report.analysis?.urgencyScore || 0}/100</p></div>`
          )
        )
        .addTo(reportsMap.current)
      bounds.extend([report.longitude, report.latitude])
    })
    if (reportsWithLocation.length > 1)
      reportsMap.current.fitBounds(bounds, { padding: 60, maxZoom: 12 })
    return () => {
      if (reportsMap.current) {
        reportsMap.current.remove()
        reportsMap.current = null
      }
    }
  }, [activeTab, myReports])

  useEffect(() => {
    if (reportLocation && useCustomNgos) fetchNearbyNgos()
  }, [reportLocation, useCustomNgos])

  // ═══════════════════════════════════════
  // DATA FETCHERS
  // ═══════════════════════════════════════

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

  const fetchStaffProfile = async () => {
    setProfileLoading(true)
    try {
      const res = await uploadApi.getStaffProfile()
      setStaffProfile(res)
    } catch (err) {
      console.error(err)
    } finally {
      setProfileLoading(false)
    }
  }

  const fetchMyApplications = async () => {
    setLoadingApplications(true)
    try {
      const res = await uploadApi.getMyApplications()
      setMyApplications(res.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingApplications(false)
    }
  }

  const fetchAllNgos = async () => {
    setLoadingAllNgos(true)
    try {
      const params = {}
      if (user?.coordinates) {
        params.latitude = user.coordinates.lat
        params.longitude = user.coordinates.lng
      }
      const res = await uploadApi.getNearbyNgos(params)
      setAllNgos(res.ngos || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingAllNgos(false)
    }
  }

  const fetchNearbyNgos = async () => {
    if (!reportLocation) return
    setLoadingNgos(true)
    try {
      const res = await uploadApi.getNearbyNgos({
        latitude: reportLocation.latitude,
        longitude: reportLocation.longitude,
        radius: 50000,
      })
      setNearbyNgos(res.ngos || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingNgos(false)
    }
  }

  // ═══════════════════════════════════════
  // HANDLERS
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

  const toggleNgoForUpload = (ngoId) => {
    setSelectedNgosForUpload((prev) =>
      prev.includes(ngoId) ? prev.filter((id) => id !== ngoId) : [...prev, ngoId]
    )
  }

  const handleLocationSearch = async (query) => {
    setLocationSearch(query)
    if (query.length < 3) { setLocationSuggestions([]); return }
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxgl.accessToken}&limit=5&country=in`
      )
      const data = await res.json()
      setLocationSuggestions(data.features || [])
    } catch {}
  }

  const handleSelectLocationSuggestion = (feature) => {
    const [lng, lat] = feature.center
    setReportLocation({ latitude: lat, longitude: lng })
    setLocationName(feature.place_name)
    setLocationSearch(feature.place_name)
    setLocationSuggestions([])
    if (locationMap.current) {
      if (locationMarker.current) locationMarker.current.remove()
      locationMarker.current = new mapboxgl.Marker({ color: '#3B82F6', draggable: true })
        .setLngLat([lng, lat])
        .addTo(locationMap.current)
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
          const res = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${mapboxgl.accessToken}`
          )
          const data = await res.json()
          const name = data.features?.[0]?.place_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
          setLocationName(name)
          setLocationSearch(name)
        } catch {
          setLocationName(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`)
        }
        if (locationMap.current) {
          if (locationMarker.current) locationMarker.current.remove()
          locationMarker.current = new mapboxgl.Marker({ color: '#3B82F6' })
            .setLngLat([longitude, latitude])
            .addTo(locationMap.current)
          locationMap.current.flyTo({ center: [longitude, latitude], zoom: 14 })
        }
      },
      (err) => alert('Location error: ' + err.message),
      { enableHighAccuracy: true }
    )
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
          setShowChat(false)
          setChatMessages([])
        }
      } catch {}
      if (attempts >= 30) { clearInterval(interval); setPolling(false) }
    }, 2000)
  }

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !polledReport) return
    const userMsg = chatInput.trim()
    setChatInput('')
    setChatMessages((prev) => [...prev, { role: 'user', content: userMsg }])
    setChatLoading(true)
    try {
      const res = await chatApi.sendMessage({ reportId: polledReport._id, message: userMsg })
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: res.message, recommendation: res.recommendation, confidence: res.confidence },
      ])
    } catch {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, AI unavailable.' }])
    } finally {
      setChatLoading(false)
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const handleUpload = async () => {
    if (!uploadType) return alert('Select upload type')
    if (!title.trim()) return alert('Enter a title')
    if (!reportLocation) return alert('Select report location')

    const ngosToUpload = useCustomNgos
      ? selectedNgosForUpload
      : myApplications
          .filter((app) => app.status === 'approved')
          .map((app) => app.ngo._id)
          .slice(0, 1)

    if (ngosToUpload.length === 0) return alert('Select at least one approved NGO')

    const formData = new FormData()
    formData.append('title', title)
    formData.append('visibility', 'draft')
    formData.append('latitude', reportLocation.latitude)
    formData.append('longitude', reportLocation.longitude)
    formData.append('locationName', locationName)
    ngosToUpload.forEach((ngoId, idx) => formData.append(`ngos[${idx}]`, ngoId))

    if (uploadType === 'text') {
      if (!textInput.trim()) return alert('Enter text')
      formData.append('description', textInput)
    } else if (uploadType === 'voice') {
      if (!voiceText.trim()) return alert('Record voice')
      formData.append('voiceText', voiceText)
      formData.append('description', voiceText)
    } else {
      if (!file) return alert('Select file')
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

  // ✅ FIXED: handleSendToCommittee - properly handles single and multiple NGOs
  const handleSendToCommittee = async (reportId) => {
    setVisibilityLoading(reportId)
    try {
      const approvedNgos = myApplications.filter((app) => app.status === 'approved')

      if (approvedNgos.length > 1) {
        // Show modal to choose which NGO(s)
        setShowSendMultipleModal(reportId)
        setSelectedNgosForSend([])
        setVisibilityLoading(null)
        return
      }

      // Single NGO - send directly
      await uploadApi.updateVisibility(reportId, 'sent')

      // ✅ FIXED: Update polledReport state if it matches
      if (polledReport?._id === reportId || polledReport?._id?.toString() === reportId) {
        setPolledReport((prev) => ({ ...prev, visibility: 'sent' }))
      }

      // ✅ FIXED: Refresh reports list
      fetchMyReports()
      setShowSendConfirm(null)
      showSuccess('✅ Report sent to committee!')
    } catch (err) {
      alert('Failed: ' + err.message)
    } finally {
      setVisibilityLoading(null)
    }
  }

  // ✅ FIXED: handleSendToMultipleNgos
  const handleSendToMultipleNgos = async () => {
    if (selectedNgosForSend.length === 0) return alert('Select at least one NGO')
    setSendToNgosLoading(true)
    try {
      await uploadApi.updateVisibility(showSendMultipleModal, 'sent')

      // ✅ FIXED: Update polledReport state
      if (polledReport?._id === showSendMultipleModal || polledReport?._id?.toString() === showSendMultipleModal) {
        setPolledReport((prev) => ({ ...prev, visibility: 'sent' }))
      }

      fetchMyReports()
      setShowSendMultipleModal(null)
      setSelectedNgosForSend([])
      showSuccess(`✅ Report sent to ${selectedNgosForSend.length} NGO(s)!`)
    } catch (err) {
      alert('Failed: ' + err.message)
    } finally {
      setSendToNgosLoading(false)
    }
  }

  // ✅ FIXED: handleVisibility - properly updates draft/sent state
  const handleVisibility = async (reportId, visibility) => {
    setVisibilityLoading(reportId)
    try {
      await uploadApi.updateVisibility(reportId, visibility)

      // ✅ FIXED: Update polledReport state correctly
      if (polledReport?._id === reportId || polledReport?._id?.toString() === reportId?.toString()) {
        setPolledReport((prev) => ({ ...prev, visibility }))
      }

      // ✅ FIXED: Always refresh reports list after visibility change
      await fetchMyReports()

      showSuccess(visibility === 'draft' ? '📝 Moved to Draft' : '✅ Sent to Committee')
    } catch (err) {
      alert('Failed: ' + err.message)
    } finally {
      setVisibilityLoading(null)
    }
  }

  const startRecording = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window))
      return alert('Use Chrome')
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-IN'
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
    setLocationSearch('')
    setSelectedNgosForUpload([])
    setUseCustomNgos(false)
  }

  const handleLogout = () => { logout(); navigate('/login') }
  const sev = (l) => SEVERITY_CONFIG[l] || SEVERITY_CONFIG.info

  // Derived
  const pendingCount = myApplications.filter((a) => a.status === 'pending').length
  const approvedCount = myApplications.filter((a) => a.status === 'approved').length

  const getAllApprovedNgoNames = () => {
    const names = []
    myApplications.filter((a) => a.status === 'approved').forEach((a) => {
      const name = a.ngo?.name
      if (name && !names.includes(name)) names.push(name)
    })
    return names
  }

  const allApprovedNgoNames = getAllApprovedNgoNames()

  const tabs = [
    { key: 'upload', label: '📤 New Report' },
    { key: 'reports', label: '📋 My Reports', badge: myReports.length },
    { key: 'my-ngos', label: '🏢 My NGOs', badge: pendingCount },
    { key: 'profile', label: '👤 Profile' },
  ]

  // ═══════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Navbar ── */}
      <nav className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📋</span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-bold text-gray-800">NGO Field Staff</h1>
                {allApprovedNgoNames.length > 0 && (
                  <div className="hidden sm:flex items-center gap-1 flex-wrap">
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
          </div>
          <button
            onClick={handleLogout}
            className="text-sm bg-red-50 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 font-medium"
          >
            Logout
          </button>
        </div>
      </nav>

      {successMsg && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-3 m-4 rounded text-sm">
          {successMsg}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 overflow-x-auto">
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-3 text-sm font-medium flex items-center gap-2 whitespace-nowrap border-b-2 transition-colors ${
                activeTab === t.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
              {t.badge > 0 && (
                <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 sm:p-6">

        {/* ══════════════════════════════════════
            UPLOAD TAB
        ══════════════════════════════════════ */}
        {activeTab === 'upload' && (
          <div className="space-y-5">

            {/* ✅ AI Analysis Result */}
            {polledReport && (
              <div className="rounded-2xl border-2 overflow-hidden">
                <div className={`p-4 ${sev(polledReport.analysis?.severityLevel).bg} flex items-center justify-between`}>
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg">🤖 AI Analysis Complete</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Model: {polledReport.analysis?.model || 'gemini'} •
                      Report: {polledReport.title}
                    </p>
                  </div>
                  <button
                    onClick={resetForm}
                    className="text-xs text-gray-500 bg-white px-3 py-1.5 rounded-lg border hover:bg-gray-50"
                  >
                    📤 New Report
                  </button>
                </div>

                <div className="bg-white p-5 space-y-4">

                  {/* ✅ Scores */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">⚡ Urgency Score</p>
                      <p className={`text-3xl font-bold ${sev(polledReport.analysis?.severityLevel).score}`}>
                        {polledReport.analysis?.urgencyScore || 0}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">/100</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">🎯 Severity</p>
                      <p className={`text-sm font-bold mt-2 ${sev(polledReport.analysis?.severityLevel).text}`}>
                        {sev(polledReport.analysis?.severityLevel).label}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">📂 Category</p>
                      <p className="text-sm font-bold mt-2 text-gray-800">
                        {polledReport.analysis?.category || '—'}
                      </p>
                    </div>
                  </div>

                  {/* ✅ Additional Analysis Info */}
                  {(polledReport.analysis?.affectedPeople || polledReport.analysis?.affectedArea || polledReport.analysis?.immediateRisk) && (
                    <div className="grid grid-cols-3 gap-3">
                      {polledReport.analysis?.affectedPeople && (
                        <div className="bg-red-50 rounded-xl p-3 text-center">
                          <p className="text-xs text-gray-500 mb-1">👥 Affected</p>
                          <p className="text-lg font-bold text-red-600">~{polledReport.analysis.affectedPeople}</p>
                          <p className="text-xs text-gray-400">people</p>
                        </div>
                      )}
                      {polledReport.analysis?.affectedArea && (
                        <div className="bg-orange-50 rounded-xl p-3 text-center">
                          <p className="text-xs text-gray-500 mb-1">📍 Area</p>
                          <p className="text-sm font-bold text-orange-600">{polledReport.analysis.affectedArea}</p>
                        </div>
                      )}
                      {polledReport.analysis?.immediateRisk !== undefined && (
                        <div className={`rounded-xl p-3 text-center ${polledReport.analysis.immediateRisk ? 'bg-red-50' : 'bg-green-50'}`}>
                          <p className="text-xs text-gray-500 mb-1">⚠️ Immediate Risk</p>
                          <p className={`text-lg font-bold ${polledReport.analysis.immediateRisk ? 'text-red-600' : 'text-green-600'}`}>
                            {polledReport.analysis.immediateRisk ? 'YES' : 'NO'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ✅ AI Summary */}
                  {polledReport.analysis?.summary && (
                    <div className={`rounded-xl p-4 ${sev(polledReport.analysis?.severityLevel).bg}`}>
                      <p className="text-xs font-semibold text-gray-600 mb-2">🤖 AI Summary</p>
                      <p className="text-sm text-gray-800 leading-relaxed">{polledReport.analysis.summary}</p>
                    </div>
                  )}

                  {/* ✅ Sentiment */}
                  {polledReport.analysis?.sentiment && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Sentiment:</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        polledReport.analysis.sentiment === 'very_negative' ? 'bg-red-100 text-red-700' :
                        polledReport.analysis.sentiment === 'negative' ? 'bg-orange-100 text-orange-700' :
                        polledReport.analysis.sentiment === 'neutral' ? 'bg-gray-100 text-gray-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {polledReport.analysis.sentiment.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                  )}

                  {/* ✅ Keywords */}
                  {polledReport.analysis?.keywords?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-2">🔑 Keywords</p>
                      <div className="flex flex-wrap gap-1.5">
                        {polledReport.analysis.keywords.map((kw, i) => (
                          <span key={i} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ✅ Key Problems */}
                  {polledReport.analysis?.keyProblems?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-2">🔍 Key Problems</p>
                      <ul className="space-y-1.5">
                        {polledReport.analysis.keyProblems.map((p, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-700 bg-red-50 rounded-lg px-3 py-2">
                            <span className="text-red-500 flex-shrink-0">•</span>{p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* ✅ Suggested Actions */}
                  {polledReport.analysis?.suggestedActions?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-2">✅ Suggested Actions</p>
                      <ul className="space-y-1.5">
                        {polledReport.analysis.suggestedActions.map((a, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-700 bg-green-50 rounded-lg px-3 py-2">
                            <span className="text-green-500 flex-shrink-0">→</span>{a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* ✅ Detailed Analysis */}
                  {polledReport.analysis?.detailedAnalysis && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-2">📊 Detailed Analysis</p>
                      <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-sm text-gray-700 leading-relaxed">{polledReport.analysis.detailedAnalysis}</p>
                      </div>
                    </div>
                  )}

                  {/* ✅ FIXED: Send to Committee / Draft Actions */}
                  <div className="border-t pt-4">
                    {polledReport.visibility !== 'sent' ? (
                      <div className="space-y-3">
                        <div className="bg-blue-50 rounded-xl p-3 text-center mb-2">
                          <p className="text-xs text-blue-700 font-medium">
                            📝 Status: <span className="font-bold">Draft</span> — Report not yet sent to committee
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const approved = myApplications.filter((a) => a.status === 'approved')
                            if (approved.length > 1) {
                              setShowSendMultipleModal(polledReport._id)
                              setSelectedNgosForSend([])
                            } else {
                              handleSendToCommittee(polledReport._id)
                            }
                          }}
                          disabled={visibilityLoading === polledReport._id}
                          className="w-full py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:from-green-700 hover:to-green-800 disabled:opacity-50"
                        >
                          {visibilityLoading === polledReport._id ? (
                            <>
                              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                              Sending...
                            </>
                          ) : (
                            '📤 Send to Committee for Review'
                          )}
                        </button>
                        <button
                          onClick={() => handleVisibility(polledReport._id, 'draft')}
                          disabled={visibilityLoading === polledReport._id}
                          className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-200 disabled:opacity-50"
                        >
                          📝 Keep as Draft
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4 text-center">
                          <div className="text-4xl mb-2">✅</div>
                          <p className="text-green-800 font-bold text-lg">Report Submitted!</p>
                          <p className="text-green-600 text-sm mt-1">
                            The committee will review and take action on this report.
                          </p>
                        </div>
                        <button
                          onClick={() => handleVisibility(polledReport._id, 'draft')}
                          disabled={visibilityLoading === polledReport._id}
                          className="w-full py-2.5 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm hover:bg-gray-200 disabled:opacity-50"
                        >
                          {visibilityLoading === polledReport._id ? '⏳...' : '↩️ Move back to Draft'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* ✅ AI Chat */}
                  <div className="border-t pt-4">
                    <button
                      onClick={() => setShowChat(!showChat)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition"
                    >
                      <span className="font-semibold text-indigo-700 text-sm">🤖 Ask AI about this report</span>
                      <span className="text-indigo-500 text-xs">{showChat ? '▲ Hide' : '▼ Show'}</span>
                    </button>
                    {showChat && (
                      <div className="mt-3 border border-indigo-100 rounded-xl overflow-hidden">
                        <div className="h-64 overflow-y-auto p-4 space-y-3 bg-gray-50">
                          {chatMessages.length === 0 && (
                            <div className="text-center text-gray-400 text-sm mt-8">
                              <p className="text-2xl mb-2">💬</p>
                              <p>Ask anything about this report's analysis</p>
                              <p className="text-xs mt-1 text-gray-300">e.g. "What actions should be taken?" or "How severe is this?"</p>
                            </div>
                          )}
                          {chatMessages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-xs px-4 py-2.5 rounded-2xl text-sm ${
                                msg.role === 'user'
                                  ? 'bg-indigo-600 text-white rounded-br-sm'
                                  : 'bg-white text-gray-800 border rounded-bl-sm shadow-sm'
                              }`}>
                                <p>{msg.content}</p>
                                {msg.confidence && (
                                  <p className="text-xs opacity-60 mt-1">Confidence: {msg.confidence}%</p>
                                )}
                              </div>
                            </div>
                          ))}
                          {chatLoading && (
                            <div className="flex justify-start">
                              <div className="bg-white border rounded-2xl px-4 py-3 shadow-sm">
                                <div className="flex gap-1">
                                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" />
                                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                              </div>
                            </div>
                          )}
                          <div ref={chatEndRef} />
                        </div>
                        <div className="flex gap-2 p-3 bg-white border-t">
                          <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                            placeholder="Ask about this report..."
                            disabled={chatLoading}
                            className="flex-1 px-3 py-2 text-sm border rounded-xl disabled:opacity-50 focus:ring-2 focus:ring-indigo-500"
                          />
                          <button
                            onClick={sendChatMessage}
                            disabled={chatLoading || !chatInput.trim()}
                            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-xl disabled:opacity-50 font-medium hover:bg-indigo-700"
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

            {/* ✅ Polling / Analyzing */}
            {polling && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-8 text-center">
                <div className="animate-spin h-14 w-14 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
                <p className="font-bold text-blue-800 text-lg">🤖 Gemini AI Analyzing...</p>
                <p className="text-blue-600 text-sm mt-2">This may take up to 30 seconds</p>
                <div className="mt-4 flex justify-center gap-1">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 200}ms` }} />
                  ))}
                </div>
              </div>
            )}

            {/* ✅ Upload Form */}
            {!polledReport && !polling && (
              <>
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Report Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Brief title describing the issue..."
                    className="w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Report Location <span className="text-red-500">*</span>
                  </label>
                  {!reportLocation ? (
                    <div className="space-y-2">
                      <button
                        onClick={handleGetLiveLocation}
                        className="w-full py-3 bg-green-50 border-2 border-green-300 rounded-xl text-green-700 font-medium text-sm hover:bg-green-100 transition"
                      >
                        📡 Use My Live Location
                      </button>
                      <button
                        onClick={() => setShowLocationPicker(true)}
                        className="w-full py-3 border-2 border-dashed border-blue-300 rounded-xl text-blue-600 font-medium text-sm hover:bg-blue-50 transition"
                      >
                        📍 Pick on Map
                      </button>
                    </div>
                  ) : (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-green-500 text-xl">✅</span>
                        <div>
                          <p className="text-sm font-medium text-green-800">Location Selected</p>
                          <p className="text-xs text-green-600">{locationName}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => { setReportLocation(null); setLocationName(''); setShowLocationPicker(true) }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Change
                      </button>
                    </div>
                  )}
                </div>

                {/* NGO Selection */}
                {reportLocation && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Submit Report To <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2 mb-3">
                      <button
                        onClick={() => { setUseCustomNgos(false); setSelectedNgosForUpload([]) }}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition ${
                          !useCustomNgos ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        🏢 My Approved NGOs
                      </button>
                      <button
                        onClick={() => setUseCustomNgos(true)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition ${
                          useCustomNgos ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        🔍 Nearby NGOs
                      </button>
                    </div>

                    {!useCustomNgos && (
                      <div className="space-y-2">
                        {myApplications.filter((a) => a.status === 'approved').length === 0 ? (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
                            <p className="text-yellow-700 text-sm font-medium">❌ No Approved NGOs Yet</p>
                            <p className="text-yellow-600 text-xs mt-1">Go to "My NGOs" tab to apply to NGOs</p>
                            <button
                              onClick={() => setActiveTab('my-ngos')}
                              className="mt-2 text-xs text-yellow-700 underline font-medium"
                            >
                              Go to My NGOs →
                            </button>
                          </div>
                        ) : (
                          myApplications
                            .filter((a) => a.status === 'approved')
                            .map((app) => (
                              <button
                                key={app._id}
                                onClick={() =>
                                  setSelectedNgosForUpload((prev) =>
                                    prev.includes(app.ngo._id)
                                      ? prev.filter((id) => id !== app.ngo._id)
                                      : [...prev, app.ngo._id]
                                  )
                                }
                                className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                                  selectedNgosForUpload.includes(app.ngo._id)
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-green-200 hover:border-green-400 bg-white'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-medium text-sm text-gray-800">✅ {app.ngo?.name}</p>
                                    {app.ngo?.locationName && (
                                      <p className="text-xs text-gray-500">📍 {app.ngo.locationName}</p>
                                    )}
                                  </div>
                                  <span className="text-xl">
                                    {selectedNgosForUpload.includes(app.ngo._id) ? '✅' : '⭕'}
                                  </span>
                                </div>
                              </button>
                            ))
                        )}
                      </div>
                    )}

                    {useCustomNgos && (
                      <div className="space-y-2">
                        {loadingNgos ? (
                          <div className="text-center py-4">
                            <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
                          </div>
                        ) : (
                          nearbyNgos
                            .filter((ngo) => {
                              const status = myApplications.find(
                                (a) => (a.ngo?._id || a.ngo)?.toString() === ngo._id?.toString()
                              )?.status
                              return status === 'approved' || ngo.isMyNgo
                            })
                            .map((ngo) => (
                              <button
                                key={ngo._id}
                                onClick={() => toggleNgoForUpload(ngo._id)}
                                className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                                  selectedNgosForUpload.includes(ngo._id)
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-green-200 hover:border-green-400 bg-white'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-medium text-sm text-gray-800">✅ {ngo.name}</p>
                                    {ngo.locationName && <p className="text-xs text-gray-500">📍 {ngo.locationName}</p>}
                                    {ngo.distance != null && <p className="text-xs text-blue-500">📏 {ngo.distance}km</p>}
                                  </div>
                                  <span className="text-xl">
                                    {selectedNgosForUpload.includes(ngo._id) ? '✅' : '⭕'}
                                  </span>
                                </div>
                              </button>
                            ))
                        )}
                        {nearbyNgos.filter((ngo) => {
                          const status = myApplications.find(
                            (a) => (a.ngo?._id || a.ngo)?.toString() === ngo._id?.toString()
                          )?.status
                          return status === 'approved' || ngo.isMyNgo
                        }).length === 0 && !loadingNgos && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
                            <p className="text-yellow-700 text-sm">No approved NGOs nearby</p>
                          </div>
                        )}
                      </div>
                    )}

                    {selectedNgosForUpload.length > 0 && (
                      <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
                        <p className="text-sm font-medium text-blue-700">
                          📤 Will submit to {selectedNgosForUpload.length} NGO(s)
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Upload Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Type <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { type: 'pdf', icon: '📄', label: 'PDF' },
                      { type: 'image', icon: '🖼️', label: 'Image' },
                      { type: 'voice', icon: '🎤', label: 'Voice' },
                      { type: 'text', icon: '✏️', label: 'Text' },
                    ].map((opt) => (
                      <button
                        key={opt.type}
                        onClick={() => setUploadType(opt.type)}
                        className={`p-4 rounded-xl border-2 text-center transition ${
                          uploadType === opt.type
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
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
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setFile(e.target.files[0])}
                      className="w-full px-4 py-3 border rounded-xl text-sm"
                    />
                    {file && <p className="text-xs text-green-600 mt-1">✅ {file.name}</p>}
                  </div>
                )}

                {uploadType === 'image' && (
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setFile(e.target.files[0])}
                      className="w-full px-4 py-3 border rounded-xl text-sm"
                    />
                    {file && (
                      <img
                        src={URL.createObjectURL(file)}
                        className="mt-2 w-full h-40 object-cover rounded-xl border"
                        alt="preview"
                      />
                    )}
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe what's in the image..."
                      rows={3}
                      className="mt-3 w-full px-4 py-3 border rounded-xl text-sm resize-none"
                    />
                  </div>
                )}

                {uploadType === 'voice' && (
                  <div className="bg-gray-50 rounded-xl p-6 text-center">
                    <button
                      onClick={recording ? stopRecording : startRecording}
                      className={`w-24 h-24 rounded-full text-4xl mx-auto block shadow-lg transition ${
                        recording ? 'bg-red-500 text-white animate-pulse' : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {recording ? '⏹️' : '🎤'}
                    </button>
                    <p className="text-xs text-gray-500 mt-3">
                      {recording ? 'Recording... tap to stop' : 'Tap to start recording'}
                    </p>
                    {voiceText && (
                      <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-4 text-left">
                        <p className="text-xs text-green-600 font-medium">✅ Transcribed:</p>
                        <p className="text-sm mt-1">{voiceText}</p>
                      </div>
                    )}
                  </div>
                )}

                {uploadType === 'text' && (
                  <div>
                    <textarea
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      placeholder="Describe the issue in detail..."
                      rows={8}
                      className="w-full px-4 py-3 border rounded-xl text-sm resize-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">{textInput.length} characters</p>
                  </div>
                )}

                {uploadType && (
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold disabled:opacity-60 flex items-center justify-center gap-2 hover:from-blue-700 hover:to-indigo-700"
                  >
                    {uploading ? (
                      <>
                        <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                        Uploading & Analyzing...
                      </>
                    ) : (
                      '🤖 Analyze with Gemini AI →'
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════
            REPORTS TAB
        ══════════════════════════════════════ */}
        {activeTab === 'reports' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-800">My Reports</h3>
                <p className="text-xs text-gray-500 mt-0.5">{myReports.length} total reports</p>
              </div>
              <button
                onClick={fetchMyReports}
                className="text-xs text-blue-600 hover:underline px-3 py-1.5 border rounded-lg hover:bg-blue-50"
              >
                🔄 Refresh
              </button>
            </div>

            {/* Reports Map */}
            {myReports.filter((r) => r.latitude && r.longitude).length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border overflow-hidden mb-6">
                <div className="px-6 py-4 border-b flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800">🗺️ Reports Map</h3>
                  <div className="flex gap-3 text-xs text-gray-500">
                    <span>🔴 Critical</span>
                    <span>🟠 High</span>
                    <span>🟡 Medium</span>
                    <span>🟢 Low</span>
                  </div>
                </div>
                <div ref={reportsMapContainer} className="w-full h-80" />
              </div>
            )}

            {loadingReports ? (
              <div className="text-center py-12">
                <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
                <p className="text-gray-500 text-sm mt-2">Loading reports...</p>
              </div>
            ) : myReports.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm border">
                <p className="text-5xl mb-3">📋</p>
                <h3 className="text-lg font-semibold text-gray-800">No reports yet</h3>
                <p className="text-gray-500 text-sm mt-1">Create your first report using the "New Report" tab</p>
                <button
                  onClick={() => setActiveTab('upload')}
                  className="mt-4 bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700"
                >
                  ➕ Create Report
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {myReports.map((report) => (
                  <div
                    key={report._id}
                    className={`bg-white rounded-2xl shadow-sm border-l-4 ${sev(report.analysis?.severityLevel).border} overflow-hidden hover:shadow-md transition`}
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-800">{report.title}</h4>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <p className="text-xs text-gray-400">
                              {new Date(report.createdAt).toLocaleString()}
                            </p>
                            {report.ngo?.name && (
                              <span className="text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">
                                🏢 {report.ngo.name}
                              </span>
                            )}
                            {report.locationName && (
                              <span className="text-xs text-gray-400">📍 {report.locationName}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 ml-3 flex-shrink-0">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${sev(report.analysis?.severityLevel).bg} ${sev(report.analysis?.severityLevel).text}`}>
                            {sev(report.analysis?.severityLevel).label}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            report.visibility === 'sent'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {report.visibility === 'sent' ? '✅ Sent to Committee' : '📝 Draft'}
                          </span>
                        </div>
                      </div>

                      {/* Urgency Bar */}
                      {report.analysis?.urgencyScore !== undefined && (
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xs text-gray-500 w-16">Urgency</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${sev(report.analysis?.severityLevel).bar}`}
                              style={{ width: `${report.analysis.urgencyScore}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-gray-700">{report.analysis.urgencyScore}/100</span>
                        </div>
                      )}

                      {report.analysis?.summary && (
                        <p className="text-xs text-gray-600 mb-3 line-clamp-2 bg-gray-50 rounded-lg p-2">
                          🤖 {report.analysis.summary}
                        </p>
                      )}

                      <div className="flex gap-2 pt-2 border-t border-gray-100">
                        {report.visibility !== 'sent' ? (
                          <>
                            <button
                              onClick={() => setShowSendConfirm(report._id)}
                              disabled={visibilityLoading === report._id}
                              className="flex-1 py-2 bg-green-600 text-white text-xs rounded-lg font-medium disabled:opacity-50 hover:bg-green-700"
                            >
                              {visibilityLoading === report._id ? '⏳ Sending...' : '📤 Send to Committee'}
                            </button>
                            <button
                              onClick={() => handleVisibility(report._id, 'draft')}
                              disabled={visibilityLoading === report._id}
                              className="px-3 py-2 bg-gray-100 text-gray-600 text-xs rounded-lg font-medium hover:bg-gray-200"
                            >
                              📝 Draft
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleVisibility(report._id, 'draft')}
                            disabled={visibilityLoading === report._id}
                            className="flex-1 py-2 bg-gray-100 text-gray-700 text-xs rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50"
                          >
                            {visibilityLoading === report._id ? '⏳...' : '↩️ Move to Draft'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════
            MY NGOS TAB
        ══════════════════════════════════════ */}
        {activeTab === 'my-ngos' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-1">🏢 My NGO Connections</h2>
              <p className="text-sm text-gray-500">
                Apply to NGOs to submit reports to their committee
              </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { val: myApplications.length, label: 'Total Applied', color: 'text-blue-600', bg: 'bg-blue-50' },
                { val: pendingCount, label: 'Pending', color: 'text-yellow-600', bg: 'bg-yellow-50' },
                { val: approvedCount, label: 'Approved', color: 'text-green-600', bg: 'bg-green-50' },
              ].map((s, i) => (
                <div key={i} className={`${s.bg} rounded-2xl p-4 text-center border`}>
                  <p className={`text-3xl font-bold ${s.color}`}>{s.val}</p>
                  <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {/* My Applications */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800">📋 My Applications</h3>
                <button onClick={fetchMyApplications} className="text-xs text-blue-600 hover:underline">🔄 Refresh</button>
              </div>

              {loadingApplications ? (
                <div className="text-center py-8">
                  <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
                </div>
              ) : myApplications.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center shadow-sm border">
                  <p className="text-4xl mb-3">📬</p>
                  <p className="text-gray-600 font-medium">No applications yet</p>
                  <p className="text-gray-500 text-sm mt-1">Discover and apply to nearby NGOs below!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myApplications.map((app) => (
                    <div
                      key={app._id}
                      className={`bg-white rounded-2xl p-4 shadow-sm border-l-4 ${
                        app.status === 'approved' ? 'border-l-green-500' :
                        app.status === 'pending' ? 'border-l-yellow-500' : 'border-l-red-500'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0 ${
                            app.status === 'approved' ? 'bg-green-100' :
                            app.status === 'pending' ? 'bg-yellow-100' : 'bg-red-100'
                          }`}>
                            {app.status === 'approved' ? '✅' : app.status === 'pending' ? '⏳' : '❌'}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800 text-sm">{app.ngo?.name || 'Unknown NGO'}</p>
                            {app.ngo?.locationName && (
                              <p className="text-xs text-gray-500">📍 {app.ngo.locationName}</p>
                            )}
                            <p className="text-xs text-gray-400">
                              Applied: {new Date(app.appliedAt || app.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <span className={`text-xs px-3 py-1 rounded-full font-bold ${
                            app.status === 'approved' ? 'bg-green-100 text-green-700' :
                            app.status === 'pending' ? 'bg-yellow-100 text-yellow-700 animate-pulse' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {app.status === 'approved' ? '✅ Approved' :
                             app.status === 'pending' ? '⏳ Pending' : '❌ Rejected'}
                          </span>
                          {app.status === 'approved' && (
                            <p className="text-xs text-green-600 mt-1">Can submit reports ✓</p>
                          )}
                          {app.status === 'pending' && (
                            <p className="text-xs text-yellow-600 mt-1">Waiting for approval</p>
                          )}
                        </div>
                      </div>
                      {app.message && (
                        <div className="mt-2 bg-gray-50 rounded-lg p-2">
                          <p className="text-xs text-gray-500">
                            Your note: <span className="text-gray-700">{app.message}</span>
                          </p>
                        </div>
                      )}
                      {app.reviewNote && (
                        <div className="mt-2 bg-blue-50 rounded-lg p-2">
                          <p className="text-xs text-blue-600">
                            NGO response: <span className="text-blue-800 italic">"{app.reviewNote}"</span>
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Discover NGOs */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-800">🔍 Discover NGOs</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Apply to submit reports to their committee</p>
                </div>
                <button onClick={fetchAllNgos} className="text-xs text-blue-600 hover:underline">🔄</button>
              </div>

              {loadingAllNgos ? (
                <div className="text-center py-8">
                  <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
                </div>
              ) : allNgos.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center shadow-sm border">
                  <p className="text-4xl mb-3">🔍</p>
                  <p className="text-gray-500 text-sm">No NGOs found in your area</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {allNgos.map((ngo) => {
                    const myApp = myApplications.find(
                      (a) => (a.ngo?._id || a.ngo)?.toString() === ngo._id?.toString()
                    )
                    const appStatus = myApp?.status || ngo.applicationStatus

                    return (
                      <div key={ngo._id} className="bg-white rounded-2xl p-4 shadow-sm border hover:shadow-md transition">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                              🏢
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-800 text-sm truncate">{ngo.name}</p>
                              {ngo.description && (
                                <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{ngo.description}</p>
                              )}
                              {ngo.locationName && (
                                <p className="text-xs text-gray-400 mt-0.5">📍 {ngo.locationName}</p>
                              )}
                              {ngo.distance != null && (
                                <p className="text-xs text-blue-500 mt-0.5">📏 {ngo.distance}km away</p>
                              )}
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            {appStatus === 'approved' ? (
                              <span className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-full font-bold">
                                ✅ Approved
                              </span>
                            ) : appStatus === 'pending' ? (
                              <span className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-full font-bold animate-pulse">
                                ⏳ Pending
                              </span>
                            ) : appStatus === 'rejected' ? (
                              <button
                                onClick={() => setShowApplyModal(ngo)}
                                className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-full font-bold border border-red-200 hover:bg-red-100"
                              >
                                🔄 Reapply
                              </button>
                            ) : (
                              <button
                                onClick={() => setShowApplyModal(ngo)}
                                className="px-4 py-2 bg-blue-600 text-white text-xs rounded-xl font-medium hover:bg-blue-700 transition"
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
          </div>
        )}

        {/* ══════════════════════════════════════
            PROFILE TAB
        ══════════════════════════════════════ */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            {profileLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-6 text-white">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-3xl shadow">
                      📋
                    </div>
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold">{staffProfile?.user?.fullName || user?.fullName}</h2>
                      <p className="text-blue-100 text-sm">{staffProfile?.user?.email || user?.email}</p>
                      <p className="text-blue-200 text-xs mt-1">
                        📍 {staffProfile?.user?.locationName || user?.locationName || 'Location not set'}
                      </p>
                    </div>
                    <span className="bg-white bg-opacity-20 text-white text-xs px-3 py-1.5 rounded-full font-medium">
                      NGO Field Staff
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { val: staffProfile?.stats?.totalReports || 0, label: 'Total Reports', color: 'text-blue-600', icon: '📊' },
                    { val: staffProfile?.stats?.sentReports || 0, label: 'Sent to Committee', color: 'text-green-600', icon: '📤' },
                    { val: staffProfile?.stats?.draftReports || 0, label: 'Drafts', color: 'text-gray-600', icon: '📝' },
                    { val: approvedCount, label: 'Approved NGOs', color: 'text-purple-600', icon: '🏢' },
                  ].map((s, i) => (
                    <div key={i} className="bg-white rounded-xl p-4 shadow-sm text-center border">
                      <p className="text-2xl mb-1">{s.icon}</p>
                      <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
                      <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Severity Stats */}
                {staffProfile?.stats?.severity && (
                  <div className="bg-white rounded-2xl p-5 shadow-sm border">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">📊 Reports by Severity</h4>
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { label: '🔴 Critical', val: staffProfile.stats.severity.critical || 0, color: 'text-red-600', bg: 'bg-red-50' },
                        { label: '🟠 High', val: staffProfile.stats.severity.high || 0, color: 'text-orange-600', bg: 'bg-orange-50' },
                        { label: '🟡 Medium', val: staffProfile.stats.severity.medium || 0, color: 'text-yellow-600', bg: 'bg-yellow-50' },
                        { label: '🟢 Low', val: staffProfile.stats.severity.low || 0, color: 'text-green-600', bg: 'bg-green-50' },
                      ].map((s, i) => (
                        <div key={i} className={`${s.bg} rounded-xl p-3 text-center`}>
                          <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
                          <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Approved NGOs */}
                {allApprovedNgoNames.length > 0 && (
                  <div className="bg-white rounded-2xl p-5 shadow-sm border">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">
                      ✅ Approved NGOs — Can Submit Reports To
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {allApprovedNgoNames.map((name, idx) => (
                        <span
                          key={idx}
                          className="bg-green-100 text-green-700 px-3 py-1.5 rounded-full text-xs font-medium border border-green-200"
                        >
                          ✅ {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Contact & Org Info */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="bg-white rounded-2xl p-5 shadow-sm border">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">📞 Contact Info</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 w-16 text-xs">Email</span>
                        <span className="text-gray-700 font-medium truncate">
                          {staffProfile?.user?.email || user?.email}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 w-16 text-xs">Phone</span>
                        <span className="text-gray-700 font-medium">
                          {staffProfile?.user?.phone || user?.phone || 'Not set'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 w-16 text-xs">Status</span>
                        <span className="text-green-600 font-semibold">
                          {staffProfile?.user?.status || user?.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 w-16 text-xs">Joined</span>
                        <span className="text-gray-700 font-medium">
                          {new Date(user?.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl p-5 shadow-sm border">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">🏢 Organization</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 w-20 text-xs">Primary</span>
                        <span className="text-gray-700 font-medium">
                          {user?.ngo?.name || 'None'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 w-20 text-xs">Total</span>
                        <span className="text-gray-700 font-medium">{myApplications.length} NGO(s) applied</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 w-20 text-xs">Approved</span>
                        <span className="text-green-600 font-semibold">{approvedCount} NGO(s)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 w-20 text-xs">Pending</span>
                        <span className="text-yellow-600 font-semibold">{pendingCount} NGO(s)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════
          MODALS
      ══════════════════════════════════════ */}

      {/* Location Picker Modal */}
      {showLocationPicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-6 border-b">
              <h3 className="text-lg font-bold text-gray-800">📍 Select Report Location</h3>
              <p className="text-xs text-gray-500 mt-1">Click on the map or search to set location</p>
            </div>
            <div className="px-4 sm:px-6 pt-4 relative">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={locationSearch}
                    onChange={(e) => handleLocationSearch(e.target.value)}
                    placeholder="Search location..."
                    className="w-full px-4 py-2.5 pl-10 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
                </div>
                <button
                  onClick={handleGetLiveLocation}
                  className="px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700"
                >
                  📡
                </button>
              </div>
              {locationSuggestions.length > 0 && (
                <div className="absolute left-4 right-4 bg-white border rounded-xl mt-1 shadow-lg z-50 max-h-48 overflow-y-auto">
                  {locationSuggestions.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => handleSelectLocationSuggestion(f)}
                      className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b text-sm last:border-b-0"
                    >
                      <p className="font-medium text-gray-800">{f.text}</p>
                      <p className="text-xs text-gray-500">{f.place_name}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div ref={locationMapContainer} className="w-full h-80 sm:h-96 mt-3" />
            {reportLocation && (
              <div className="p-4 bg-green-50 border-t border-green-200">
                <p className="text-sm font-medium text-green-800">✅ {locationName}</p>
              </div>
            )}
            <div className="p-4 sm:p-6 border-t flex gap-3">
              <button
                onClick={() => { setShowLocationPicker(false); if (!reportLocation) setLocationName('') }}
                className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl text-gray-600 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowLocationPicker(false)}
                disabled={!reportLocation}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-medium disabled:opacity-50 hover:bg-blue-700"
              >
                Confirm Location
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Confirm Modal */}
      {showSendConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">📤</div>
              <h3 className="text-lg font-bold text-gray-800">Send to Committee?</h3>
              <p className="text-sm text-gray-600 mt-2">
                The committee will review this report and decide on actions.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSendConfirm(null)}
                className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl text-gray-600 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSendToCommittee(showSendConfirm)}
                disabled={visibilityLoading === showSendConfirm}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-xl font-medium disabled:opacity-50 hover:bg-green-700"
              >
                {visibilityLoading === showSendConfirm ? '⏳ Sending...' : '✅ Confirm Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send to Multiple NGOs Modal */}
      {showSendMultipleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b bg-blue-50">
              <h3 className="text-lg font-bold text-gray-800">📤 Select Committee(s) to Send</h3>
              <p className="text-sm text-gray-600 mt-1">Choose which NGO's committee should receive this report</p>
            </div>
            <div className="p-6 space-y-3 max-h-72 overflow-y-auto">
              {myApplications
                .filter((app) => app.status === 'approved')
                .map((app) => (
                  <button
                    key={app._id}
                    onClick={() =>
                      setSelectedNgosForSend((prev) =>
                        prev.includes(app.ngo._id)
                          ? prev.filter((id) => id !== app.ngo._id)
                          : [...prev, app.ngo._id]
                      )
                    }
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      selectedNgosForSend.includes(app.ngo._id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-800">{app.ngo.name}</p>
                        {app.ngo.locationName && (
                          <p className="text-xs text-gray-500 mt-0.5">📍 {app.ngo.locationName}</p>
                        )}
                      </div>
                      <span className="text-xl">
                        {selectedNgosForSend.includes(app.ngo._id) ? '✅' : '⭕'}
                      </span>
                    </div>
                  </button>
                ))}
            </div>
            {selectedNgosForSend.length > 0 && (
              <div className="px-6 py-3 bg-blue-50 border-t border-blue-200">
                <p className="text-sm font-medium text-blue-700">
                  📤 Sending to {selectedNgosForSend.length} committee(s)
                </p>
              </div>
            )}
            <div className="p-6 border-t flex gap-3">
              <button
                onClick={() => { setShowSendMultipleModal(null); setSelectedNgosForSend([]) }}
                className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl text-gray-600 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSendToMultipleNgos}
                disabled={selectedNgosForSend.length === 0 || sendToNgosLoading}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-xl font-medium disabled:opacity-50 hover:bg-green-700"
              >
                {sendToNgosLoading ? '⏳ Sending...' : `✅ Send to ${selectedNgosForSend.length || ''} Committee(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apply to NGO Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="text-center mb-5">
              <div className="text-5xl mb-3">📩</div>
              <h3 className="text-lg font-bold text-gray-800">Apply to {showApplyModal.name}</h3>
              <p className="text-sm text-gray-500 mt-1">
                Request access to submit field reports to this NGO's committee
              </p>
              {showApplyModal.locationName && (
                <p className="text-xs text-gray-400 mt-1">📍 {showApplyModal.locationName}</p>
              )}
              {showApplyModal.distance != null && (
                <p className="text-xs text-blue-500 mt-1">📏 {showApplyModal.distance}km away</p>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message <span className="text-gray-400">(optional)</span>
              </label>
              <textarea
                value={applyMessage}
                onChange={(e) => setApplyMessage(e.target.value)}
                placeholder="Why do you want to submit reports to this NGO? What area do you cover?"
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-5">
              <p className="text-xs text-blue-800">
                💡 The NGO committee will review your application. Once approved, you can submit
                field reports that the committee will receive and act upon.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowApplyModal(null); setApplyMessage('') }}
                className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl text-gray-600 font-medium"
              >
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