import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { ngoManagerApi } from '../../api/authApi'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN
// ✅ Disable Mapbox telemetry to prevent ERR_CONNECTION_REFUSED in dev
mapboxgl.config = {
  ...mapboxgl.config,
  EVENTS_URL: '',
}

const BASE_URL =
  import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000'

const SEVERITY_CONFIG = {
  critical: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-500', label: '🔴 CRITICAL', bar: 'bg-red-500' },
  high: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-500', label: '🟠 HIGH', bar: 'bg-orange-500' },
  medium: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-500', label: '🟡 MEDIUM', bar: 'bg-yellow-500' },
  low: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-500', label: '🟢 LOW', bar: 'bg-green-500' },
  info: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300', label: '⚪ INFO', bar: 'bg-gray-400' },
}

export default function NgoManagerDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [actionLoading, setActionLoading] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  // Zone creation
  const [showZoneModal, setShowZoneModal] = useState(false)
  const [zoneForm, setZoneForm] = useState({
    name: '', description: '', latitude: null, longitude: null,
    locationName: '', city: '', state: '', country: 'India', pincode: '',
  })
  const [zoneErrors, setZoneErrors] = useState({})

  // Reports
  const [reports, setReports] = useState([])
  const [reportStats, setReportStats] = useState(null)
  const [reportsLoading, setReportsLoading] = useState(false)
  const [selectedReport, setSelectedReport] = useState(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reportFilters, setReportFilters] = useState({
    severity: '', status: '', visibility: '', search: '',
  })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)

  // Maps
  const mapContainer = useRef(null)
  const map = useRef(null)
  const zoneMapContainer = useRef(null)
  const zoneMap = useRef(null)
  const zoneMapMarker = useRef(null)

  const showSuccess = (msg) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 3000)
  }
  const sev = (l) => SEVERITY_CONFIG[l] || SEVERITY_CONFIG.info

  useEffect(() => { fetchDashboard() }, [])

  useEffect(() => {
    if (activeTab === 'reports') {
      fetchReports()
      fetchReportStats()
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'reports') fetchReports()
  }, [reportFilters.severity, reportFilters.status, reportFilters.visibility])

  // Main map
  useEffect(() => {
    if (!data || !mapContainer.current || map.current) return
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [78.9629, 22.5937],
      zoom: 4,
    })
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')

    if (data.zones?.length > 0) {
      const bounds = new mapboxgl.LngLatBounds()
      data.zones.forEach(zone => {
        if (zone.latitude && zone.longitude) {
          const el = document.createElement('div')
          el.style.cssText = 'width:32px;height:32px;background:#2563EB;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:14px;font-weight:bold;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);cursor:pointer;'
          el.innerHTML = '📍'
          new mapboxgl.Marker(el)
            .setLngLat([zone.longitude, zone.latitude])
            .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`
              <div style="padding:8px;">
                <h3 style="font-weight:bold;font-size:14px;margin:0 0 4px;">${zone.name}</h3>
                <p style="font-size:12px;color:#666;margin:0;">${zone.locationName || ''}</p>
              </div>
            `))
            .addTo(map.current)
          bounds.extend([zone.longitude, zone.latitude])
        }
      })
      if (data.zones.some(z => z.latitude && z.longitude)) {
        map.current.fitBounds(bounds, { padding: 60, maxZoom: 8 })
      }
    }
    if (data.ngo?.location?.coordinates) {
      const [lng, lat] = data.ngo.location.coordinates
      if (lng && lat) {
        new mapboxgl.Marker({ color: '#DC2626' })
          .setLngLat([lng, lat])
          .setPopup(new mapboxgl.Popup().setHTML(`<div style="padding:8px;"><h3 style="font-weight:bold;font-size:14px;margin:0;">🏢 ${data.ngo.name}</h3><p style="font-size:12px;color:#666;margin:4px 0 0;">NGO HQ</p></div>`))
          .addTo(map.current)
      }
    }
    return () => { if (map.current) { map.current.remove(); map.current = null } }
  }, [data])

  // Zone modal map
  useEffect(() => {
    if (!showZoneModal) return
    setTimeout(() => {
      if (!zoneMapContainer.current || zoneMap.current) return
      zoneMap.current = new mapboxgl.Map({
        container: zoneMapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [78.9629, 22.5937], zoom: 4,
      })
      zoneMap.current.on('click', async (e) => {
        const { lng, lat } = e.lngLat
        if (zoneMapMarker.current) zoneMapMarker.current.remove()
        zoneMapMarker.current = new mapboxgl.Marker({ color: '#2563EB' }).setLngLat([lng, lat]).addTo(zoneMap.current)
        zoneMap.current.flyTo({ center: [lng, lat], zoom: 10 })
        try {
          const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxgl.accessToken}&language=en`)
          const geoData = await res.json()
          const feature = geoData.features?.[0]
          const context = feature?.context || []
          setZoneForm(prev => ({
            ...prev, latitude: lat, longitude: lng,
            locationName: feature?.place_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
            city: context.find(c => c.id.startsWith('place'))?.text || '',
            state: context.find(c => c.id.startsWith('region'))?.text || '',
            pincode: context.find(c => c.id.startsWith('postcode'))?.text || '',
          }))
        } catch {
          setZoneForm(prev => ({ ...prev, latitude: lat, longitude: lng, locationName: `${lat.toFixed(4)}, ${lng.toFixed(4)}` }))
        }
      })
    }, 300)
    return () => { if (zoneMap.current) { zoneMap.current.remove(); zoneMap.current = null } }
  }, [showZoneModal])

  // ── Fetchers ─────────────────────────────────
  const fetchDashboard = async () => {
    setLoading(true)
    try {
      const res = await ngoManagerApi.getDashboard()
      setData(res)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const fetchReports = async () => {
    setReportsLoading(true)
    try {
      const res = await ngoManagerApi.getNgoReports({
        severity: reportFilters.severity || undefined,
        status: reportFilters.status || undefined,
        visibility: reportFilters.visibility || undefined,
        search: reportFilters.search || undefined,
      })
      setReports(res.reports || [])
    } catch (err) { console.error(err) }
    finally { setReportsLoading(false) }
  }

  const fetchReportStats = async () => {
    try {
      const res = await ngoManagerApi.getReportStats()
      setReportStats(res.stats)
    } catch (err) { console.error(err) }
  }

  // ── Handlers ─────────────────────────────────
  const handleCreateZone = async () => {
    const errs = {}
    if (!zoneForm.name.trim()) errs.name = 'Zone name is required'
    if (!zoneForm.latitude) errs.location = 'Select location on map'
    setZoneErrors(errs)
    if (Object.keys(errs).length > 0) return
    setActionLoading('zone')
    try {
      await ngoManagerApi.createZone(zoneForm)
      setShowZoneModal(false)
      setZoneForm({ name: '', description: '', latitude: null, longitude: null, locationName: '', city: '', state: '', country: 'India', pincode: '' })
      if (map.current) { map.current.remove(); map.current = null }
      await fetchDashboard()
      showSuccess('Zone created!')
    } catch (err) { alert('Failed: ' + err.message) }
    finally { setActionLoading(null) }
  }

  const handleDeleteZone = async (zoneId, zoneName) => {
    if (!confirm(`Delete zone "${zoneName}"?`)) return
    setActionLoading(zoneId)
    try {
      await ngoManagerApi.deleteZone(zoneId)
      if (map.current) { map.current.remove(); map.current = null }
      await fetchDashboard()
      showSuccess('Zone deleted')
    } catch (err) { alert('Failed: ' + err.message) }
    finally { setActionLoading(null) }
  }

  const handleApproveCommittee = async (memberId, zoneId) => {
    setActionLoading(memberId)
    try {
      await ngoManagerApi.approveCommittee(memberId, zoneId)
      await fetchDashboard()
      showSuccess('Committee member approved')
    } catch (err) { alert('Failed: ' + err.message) }
    finally { setActionLoading(null) }
  }

  const handleApproveStaff = async (memberId, zoneId) => {
    setActionLoading(memberId)
    try {
      await ngoManagerApi.approveStaff(memberId, zoneId)
      await fetchDashboard()
      showSuccess('Staff approved')
    } catch (err) { alert('Failed: ' + err.message) }
    finally { setActionLoading(null) }
  }

  const handleDecline = async (memberId) => {
    if (!confirm('Decline this user?')) return
    setActionLoading(memberId)
    try {
      await ngoManagerApi.declineUser(memberId)
      await fetchDashboard()
      showSuccess('User declined')
    } catch (err) { alert('Failed: ' + err.message) }
    finally { setActionLoading(null) }
  }

  const handleReviewReport = async (status) => {
    if (!selectedReport) return
    setReviewLoading(true)
    try {
      await ngoManagerApi.reviewReport(selectedReport._id, { status, reviewNotes })
      setSelectedReport(null)
      setReviewNotes('')
      fetchReports()
      fetchReportStats()
      fetchDashboard()
      showSuccess(`Report marked as ${status}`)
    } catch (err) { alert('Failed: ' + err.message) }
    finally { setReviewLoading(false) }
  }

  const handleDeleteReport = async (reportId) => {
    setActionLoading(reportId)
    try {
      await ngoManagerApi.deleteReport(reportId)
      setShowDeleteConfirm(null)
      fetchReports()
      fetchReportStats()
      fetchDashboard()
      showSuccess('Report deleted')
    } catch (err) { alert('Failed: ' + err.message) }
    finally { setActionLoading(null) }
  }

  const handleLogout = () => { logout(); navigate('/login') }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="text-gray-500 mt-4">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!data?.ngo || data.ngo.status !== 'approved') {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏢</span>
            <div><h1 className="font-bold text-gray-800">NGO Manager</h1><p className="text-xs text-gray-500">{user?.email}</p></div>
          </div>
          <button onClick={handleLogout} className="text-sm bg-red-50 text-red-600 px-4 py-2 rounded-lg">Logout</button>
        </nav>
        <div className="max-w-lg mx-auto mt-20 text-center p-8">
          <div className="text-7xl mb-4">⏳</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">NGO Pending Approval</h2>
          <p className="text-gray-500">Waiting for Super Admin approval.</p>
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <p className="text-yellow-800 text-sm">NGO: <strong>{data?.ngo?.name || 'N/A'}</strong></p>
            <p className="text-yellow-700 text-xs mt-1">Status: <strong className="uppercase">{data?.ngo?.status || 'pending'}</strong></p>
          </div>
        </div>
      </div>
    )
  }

  const { ngo, stats, zones, pendingCommittee, pendingStaff, committeeMembers, ngoStaff, volunteers } = data

  const tabs = [
    { key: 'overview', label: 'Overview', icon: '📊' },
    { key: 'map', label: 'Map', icon: '🗺️' },
    { key: 'zones', label: 'Zones', icon: '📍', badge: stats.totalZones },
    { key: 'reports', label: 'Reports', icon: '📋', badge: stats.pendingReviewReports },
    { key: 'team', label: 'Team', icon: '👥', badge: stats.totalPeople },
    { key: 'approvals', label: 'Approvals', icon: '⏳', badge: stats.pendingApprovals },
  ]

  // Filtered reports for search
  const filteredReports = reports.filter(r => {
    if (!reportFilters.search) return true
    const q = reportFilters.search.toLowerCase()
    return r.title?.toLowerCase().includes(q) ||
      r.analysis?.category?.toLowerCase().includes(q) ||
      r.submittedBy?.fullName?.toLowerCase().includes(q)
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🏢</span>
          <div>
            <h1 className="font-bold text-gray-800">{ngo.name}</h1>
            <p className="text-xs text-gray-500">NGO Manager • {user?.fullName}</p>
          </div>
          <span className="bg-green-100 text-green-700 text-xs px-2.5 py-1 rounded-full font-medium ml-2">✅ Approved</span>
          {/* People count badge */}
          <div className="hidden md:flex items-center gap-2 ml-3 px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-200">
            <span className="text-xs text-blue-700 font-medium">
              👥 {stats.totalPeople} people
            </span>
            <span className="text-xs text-blue-500">
              ({stats.totalCommitteeMembers} committee • {stats.totalStaff} staff • {stats.totalVolunteers} volunteers)
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {ngo.locationName && <span className="text-xs text-gray-400 hidden md:block">📍 {ngo.locationName}</span>}
          <button onClick={handleLogout} className="text-sm bg-red-50 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 font-medium">Logout</button>
        </div>
      </nav>

      {successMsg && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-3 mx-6 mt-4 rounded text-sm animate-pulse">✅ {successMsg}</div>
      )}

      {/* Tabs */}
      <div className="bg-white border-b px-6">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium flex items-center gap-2 whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              <span>{tab.icon}</span>{tab.label}
              {tab.badge > 0 && <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{tab.badge}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">

        {/* ══════ OVERVIEW ══════ */}
        {activeTab === 'overview' && (
          <div>
            {/* NGO Card */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white mb-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{ngo.name}</h2>
                  {ngo.description && <p className="text-blue-100 mt-1 text-sm max-w-lg">{ngo.description}</p>}
                  <div className="flex flex-wrap gap-4 mt-3 text-xs text-blue-200">
                    {ngo.contactEmail && <span>📧 {ngo.contactEmail}</span>}
                    {ngo.website && <span>🌐 {ngo.website}</span>}
                    {ngo.locationName && <span>📍 {ngo.locationName}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="bg-white bg-opacity-20 rounded-xl px-4 py-2">
                    <p className="text-2xl font-bold">{stats.totalPeople}</p>
                    <p className="text-xs text-blue-200">Total People</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
              {[
                { label: 'Zones', value: stats.totalZones, icon: '📍', bg: 'bg-blue-50', color: 'text-blue-600' },
                { label: 'Committee', value: stats.totalCommitteeMembers, icon: '👥', bg: 'bg-purple-50', color: 'text-purple-600' },
                { label: 'Staff', value: stats.totalStaff, icon: '📋', bg: 'bg-orange-50', color: 'text-orange-600' },
                { label: 'Volunteers', value: stats.totalVolunteers, icon: '🙋', bg: 'bg-green-50', color: 'text-green-600' },
                { label: 'Pending', value: stats.pendingApprovals, icon: '⏳', bg: 'bg-red-50', color: 'text-red-600' },
                { label: 'Total Reports', value: stats.totalReports, icon: '📊', bg: 'bg-indigo-50', color: 'text-indigo-600' },
                { label: 'Critical', value: stats.criticalReports, icon: '🔴', bg: 'bg-red-50', color: 'text-red-600' },
                { label: 'Pending Review', value: stats.pendingReviewReports, icon: '📝', bg: 'bg-yellow-50', color: 'text-yellow-600' },
                { label: 'Active Tasks', value: stats.activeTasks, icon: '✅', bg: 'bg-teal-50', color: 'text-teal-600' },
                { label: 'Resolved', value: stats.resolvedReports, icon: '✅', bg: 'bg-emerald-50', color: 'text-emerald-600' },
              ].map(card => (
                <div key={card.label} className={`rounded-2xl p-4 shadow-sm border border-gray-100 ${card.bg}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500">{card.label}</p>
                      <p className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value || 0}</p>
                    </div>
                    <span className="text-2xl">{card.icon}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Map */}
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden mb-6">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">🗺️ Zone Map</h3>
                <button onClick={() => setActiveTab('map')} className="text-xs text-blue-600 hover:underline">Full Map →</button>
              </div>
              <div ref={mapContainer} className="w-full h-80" />
            </div>
          </div>
        )}

        {/* ══════ MAP ══════ */}
        {activeTab === 'map' && (
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-800">Operations Map</h3>
                <p className="text-xs text-gray-500">🔴 NGO HQ • 🔵 Zones</p>
              </div>
              <span className="text-sm text-gray-500">{zones.length} zones</span>
            </div>
            <div className="w-full h-[500px] flex items-center justify-center text-gray-400">
              {map.current ? null : <p>Switch to Overview first to load map</p>}
            </div>
            <div className="border-t divide-y">
              {zones.map(zone => (
                <div key={zone._id} className="p-4 px-6 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📍</span>
                    <div>
                      <p className="font-medium text-gray-800">{zone.name}</p>
                      <p className="text-xs text-gray-500">{zone.city}{zone.state ? ', ' + zone.state : ''}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">Committee: {zone.committeeMembers?.length || 0}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════ ZONES ══════ */}
        {activeTab === 'zones' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">Zones ({zones.length})</h3>
              <button onClick={() => setShowZoneModal(true)} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 flex items-center gap-2">➕ Create Zone</button>
            </div>
            {zones.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm border">
                <p className="text-5xl mb-3">📍</p>
                <h3 className="text-lg font-semibold">No zones yet</h3>
                <button onClick={() => setShowZoneModal(true)} className="mt-4 bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium">➕ Create First Zone</button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {zones.map(zone => (
                  <div key={zone._id} className="bg-white rounded-2xl p-5 shadow-sm border">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-800 text-lg">{zone.name}</h4>
                        {zone.description && <p className="text-sm text-gray-500 mt-0.5">{zone.description}</p>}
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${zone.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{zone.status}</span>
                    </div>
                    <div className="space-y-1.5 text-xs text-gray-500 mb-4">
                      {zone.locationName && <p>📍 {zone.locationName}</p>}
                      {(zone.city || zone.state) && <p>🏙️ {zone.city}{zone.state ? ', ' + zone.state : ''} {zone.pincode}</p>}
                      <p>👥 Committee: {zone.committeeMembers?.length || 0}</p>
                    </div>
                    {zone.committeeMembers?.length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-3 mb-3">
                        <p className="text-xs font-medium text-gray-600 mb-2">Committee:</p>
                        {zone.committeeMembers.map(m => (
                          <div key={m._id} className="flex items-center gap-2 text-xs text-gray-600 mb-1">
                            <span className={`w-2 h-2 rounded-full ${m.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                            <span>{m.fullName}</span><span className="text-gray-400">({m.email})</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <button onClick={() => handleDeleteZone(zone._id, zone.name)} disabled={actionLoading === zone._id} className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50">🗑️ Delete</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════ REPORTS ══════ */}
        {activeTab === 'reports' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-800">All Reports</h3>
                <p className="text-sm text-gray-500">All reports from your NGO staff across all zones</p>
              </div>
              <button onClick={() => { fetchReports(); fetchReportStats() }} className="text-sm text-blue-600 hover:underline">🔄 Refresh</button>
            </div>

            {/* Report Stats */}
            {reportStats && (
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-5">
                {[
                  { label: 'Total', value: reportStats.total, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Drafts', value: reportStats.drafts, color: 'text-gray-600', bg: 'bg-gray-50' },
                  { label: 'Sent', value: reportStats.sent, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                  { label: 'Critical', value: reportStats.critical, color: 'text-red-600', bg: 'bg-red-50' },
                  { label: 'Pending Review', value: reportStats.pendingReview, color: 'text-yellow-600', bg: 'bg-yellow-50' },
                  { label: 'Resolved', value: reportStats.resolved, color: 'text-green-600', bg: 'bg-green-50' },
                ].map(s => (
                  <div key={s.label} className={`rounded-xl p-3 ${s.bg} text-center`}>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value || 0}</p>
                    <p className="text-xs text-gray-500">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Staff Breakdown */}
            {reportStats?.staffBreakdown?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border p-4 mb-5">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">📋 Reports by Staff Member</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {reportStats.staffBreakdown.map(s => (
                    <div key={s._id} className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-sm font-medium text-gray-800">{s.fullName}</p>
                      <p className="text-lg font-bold text-blue-600">{s.totalReports}</p>
                      <p className="text-xs text-gray-500">{s.sentReports} sent</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-5">
              <div className="relative flex-1 min-w-[200px]">
                <input type="text" value={reportFilters.search} onChange={e => setReportFilters(f => ({ ...f, search: e.target.value }))}
                  placeholder="Search reports..." className="w-full px-4 py-2 pl-10 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500" />
                <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
              </div>
              <select value={reportFilters.visibility} onChange={e => setReportFilters(f => ({ ...f, visibility: e.target.value }))} className="px-3 py-2 border rounded-xl text-sm">
                <option value="">All Visibility</option>
                <option value="draft">📝 Draft</option>
                <option value="sent">📤 Sent</option>
              </select>
              <select value={reportFilters.severity} onChange={e => setReportFilters(f => ({ ...f, severity: e.target.value }))} className="px-3 py-2 border rounded-xl text-sm">
                <option value="">All Severity</option>
                <option value="critical">🔴 Critical</option>
                <option value="high">🟠 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
              <select value={reportFilters.status} onChange={e => setReportFilters(f => ({ ...f, status: e.target.value }))} className="px-3 py-2 border rounded-xl text-sm">
                <option value="">All Status</option>
                <option value="analyzed">⏳ Pending Review</option>
                <option value="reviewed">👁️ Reviewed</option>
                <option value="resolved">✅ Resolved</option>
                <option value="rejected">❌ Rejected</option>
              </select>
            </div>

            {/* Reports List */}
            {reportsLoading ? (
              <div className="text-center py-12"><div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" /></div>
            ) : filteredReports.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm"><p className="text-5xl mb-3">📊</p><p className="text-gray-500">No reports found</p></div>
            ) : (
              <div className="space-y-4">
                {filteredReports.map(report => {
                  const severity = report.analysis?.severityLevel || 'info'
                  return (
                    <div key={report._id} className={`bg-white rounded-2xl shadow-sm border-l-4 overflow-hidden hover:shadow-md transition ${sev(severity).border}`}>
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <h4 className="font-semibold text-gray-800 text-lg">{report.title}</h4>
                              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${sev(severity).bg} ${sev(severity).text}`}>{sev(severity).label}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${report.visibility === 'sent' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                {report.visibility === 'sent' ? '📤 Sent' : '📝 Draft'}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                report.status === 'analyzed' ? 'bg-purple-100 text-purple-700' :
                                report.status === 'reviewed' ? 'bg-blue-100 text-blue-700' :
                                report.status === 'resolved' ? 'bg-green-100 text-green-700' :
                                report.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>{report.status?.toUpperCase()}</span>
                            </div>

                            <div className="flex flex-wrap gap-3 text-xs text-gray-400 mb-3">
                              <span>👤 {report.submittedBy?.fullName || 'Unknown'}</span>
                              <span>📅 {new Date(report.createdAt).toLocaleString()}</span>
                              {report.zone?.name && <span>📍 Zone: {report.zone.name}</span>}
                              {report.locationName && <span>📍 {report.locationName}</span>}
                            </div>

                            {/* Urgency Bar */}
                            <div className="flex items-center gap-3 mb-3">
                              <span className="text-xs text-gray-500 w-16">Urgency</span>
                              <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                                <div className={`h-2.5 rounded-full ${sev(severity).bar}`} style={{ width: `${report.analysis?.urgencyScore || 0}%` }} />
                              </div>
                              <span className="text-sm font-bold text-gray-700 w-12 text-right">{report.analysis?.urgencyScore || 0}</span>
                            </div>

                            {report.analysis?.summary && (
                              <div className={`rounded-xl p-3 mb-3 ${sev(severity).bg}`}>
                                <p className="text-xs font-medium text-gray-600 mb-1">🤖 AI Summary</p>
                                <p className="text-sm text-gray-800 leading-relaxed line-clamp-2">{report.analysis.summary}</p>
                              </div>
                            )}

                            <div className="flex flex-wrap gap-1.5">
                              {report.analysis?.category && <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">📂 {report.analysis.category}</span>}
                              {report.analysis?.keywords?.slice(0, 3).map(kw => <span key={kw} className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{kw}</span>)}
                            </div>
                          </div>

                          {/* Right Actions */}
                          <div className="flex flex-col gap-2 flex-shrink-0 w-36">
                            {report.fileUrl && report.fileType === 'image' && (
                              <div className="border rounded-xl overflow-hidden">
                                <img src={`${BASE_URL}${report.fileUrl}`} alt="proof" className="w-full h-20 object-cover" />
                              </div>
                            )}
                            {report.fileUrl && report.fileType === 'pdf' && (
                              <a href={`${BASE_URL}${report.fileUrl}`} target="_blank" rel="noreferrer"
                                className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg p-2 hover:bg-blue-100 font-medium">📄 View PDF</a>
                            )}
                            <button onClick={() => setSelectedReport(report)} className="px-3 py-2 bg-purple-600 text-white text-xs rounded-lg font-medium hover:bg-purple-700">
                              {report.status === 'analyzed' && report.visibility === 'sent' ? '👁️ Review' : '📋 Details'}
                            </button>
                            <button onClick={() => setShowDeleteConfirm(report._id)} className="px-3 py-2 bg-red-50 text-red-600 text-xs rounded-lg font-medium hover:bg-red-100">🗑️ Delete</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════ TEAM ══════ */}
        {activeTab === 'team' && (
          <div className="space-y-6">
            {/* People Summary */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-200">
              <h4 className="font-semibold text-gray-800 mb-3">👥 NGO Team Summary</h4>
              <div className="grid grid-cols-4 gap-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{stats.totalPeople}</p>
                  <p className="text-xs text-gray-500">Total People</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">{stats.totalCommitteeMembers}</p>
                  <p className="text-xs text-gray-500">Committee</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-600">{stats.totalStaff}</p>
                  <p className="text-xs text-gray-500">Staff</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{stats.totalVolunteers}</p>
                  <p className="text-xs text-gray-500">Volunteers</p>
                </div>
              </div>
            </div>

            {/* Committee Members */}
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <div className="px-6 py-4 border-b bg-purple-50">
                <h3 className="font-semibold text-purple-800">👥 Committee Members ({committeeMembers.length})</h3>
              </div>
              {committeeMembers.length === 0 ? (
                <div className="p-8 text-center text-gray-400">No committee members yet</div>
              ) : (
                <div className="divide-y">
                  {committeeMembers.map(m => (
                    <div key={m._id} className="p-4 px-6 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-lg">👤</div>
                        <div>
                          <p className="font-medium text-gray-800">{m.fullName}</p>
                          <p className="text-xs text-gray-500">{m.email} • {m.phone}</p>
                          {m.locationName && <p className="text-xs text-gray-400">📍 {m.locationName}</p>}
                        </div>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full ${m.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{m.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Staff */}
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <div className="px-6 py-4 border-b bg-orange-50">
                <h3 className="font-semibold text-orange-800">📋 NGO Staff ({ngoStaff.length})</h3>
              </div>
              {ngoStaff.length === 0 ? (
                <div className="p-8 text-center text-gray-400">No staff yet</div>
              ) : (
                <div className="divide-y">
                  {ngoStaff.map(s => (
                    <div key={s._id} className="p-4 px-6 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-lg">📋</div>
                        <div>
                          <p className="font-medium text-gray-800">{s.fullName}</p>
                          <p className="text-xs text-gray-500">{s.email} • {s.phone}</p>
                        </div>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{s.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Volunteers */}
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <div className="px-6 py-4 border-b bg-green-50">
                <h3 className="font-semibold text-green-800">🙋 Volunteers ({volunteers.length})</h3>
              </div>
              {volunteers.length === 0 ? (
                <div className="p-8 text-center text-gray-400">No volunteers yet</div>
              ) : (
                <div className="divide-y">
                  {volunteers.map(v => (
                    <div key={v._id} className="p-4 px-6 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-lg">🙋</div>
                        <div>
                          <p className="font-medium text-gray-800">{v.fullName}</p>
                          <p className="text-xs text-gray-500">{v.email}</p>
                          {v.volunteerProfile?.skills?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {v.volunteerProfile.skills.slice(0, 3).map(s => <span key={s} className="bg-blue-50 text-blue-600 text-xs px-2 py-0.5 rounded-full">{s}</span>)}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full ${v.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{v.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════ APPROVALS ══════ */}
        {activeTab === 'approvals' && (
          <div className="space-y-6">
            {/* Pending Committee */}
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <div className="px-6 py-4 border-b"><h3 className="font-semibold text-gray-800">👥 Pending Committee ({pendingCommittee.length})</h3></div>
              {pendingCommittee.length === 0 ? (
                <div className="p-8 text-center text-gray-400">✅ No pending</div>
              ) : (
                <div className="divide-y">
                  {pendingCommittee.map(m => (
                    <div key={m._id} className="p-5 px-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-gray-800">{m.fullName}</p>
                          <p className="text-sm text-gray-500">{m.email} • {m.phone}</p>
                          {m.locationName && <p className="text-xs text-gray-400 mt-1">📍 {m.locationName}</p>}
                          <div className="mt-3">
                            <label className="text-xs font-medium text-gray-600">Assign to Zone:</label>
                            <select id={'zone-' + m._id} className="ml-2 px-3 py-1.5 border rounded-lg text-xs">
                              <option value="">-- Select --</option>
                              {zones.map(z => <option key={z._id} value={z._id}>{z.name}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => { const zoneId = document.getElementById('zone-' + m._id)?.value; handleApproveCommittee(m._id, zoneId) }}
                            disabled={actionLoading === m._id} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg font-medium disabled:opacity-50">
                            {actionLoading === m._id ? '...' : '✅ Approve'}
                          </button>
                          <button onClick={() => handleDecline(m._id)} disabled={actionLoading === m._id} className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg font-medium disabled:opacity-50">❌</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pending Staff */}
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <div className="px-6 py-4 border-b"><h3 className="font-semibold text-gray-800">📋 Pending Staff ({pendingStaff.length})</h3></div>
              {pendingStaff.length === 0 ? (
                <div className="p-8 text-center text-gray-400">✅ No pending</div>
              ) : (
                <div className="divide-y">
                  {pendingStaff.map(s => (
                    <div key={s._id} className="p-5 px-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-gray-800">{s.fullName}</p>
                          <p className="text-sm text-gray-500">{s.email} • {s.phone}</p>
                          {s.locationName && <p className="text-xs text-gray-400 mt-1">📍 {s.locationName}</p>}
                          <div className="mt-3">
                            <label className="text-xs font-medium text-gray-600">Assign to Zone:</label>
                            <select id={'staff-zone-' + s._id} className="ml-2 px-3 py-1.5 border rounded-lg text-xs">
                              <option value="">-- Select --</option>
                              {zones.map(z => <option key={z._id} value={z._id}>{z.name}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => { const zoneId = document.getElementById('staff-zone-' + s._id)?.value; handleApproveStaff(s._id, zoneId) }}
                            disabled={actionLoading === s._id} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg font-medium disabled:opacity-50">
                            {actionLoading === s._id ? '...' : '✅ Approve'}
                          </button>
                          <button onClick={() => handleDecline(s._id)} disabled={actionLoading === s._id} className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg font-medium disabled:opacity-50">❌</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ══ REVIEW REPORT MODAL ══ */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between z-10">
              <h3 className="text-lg font-bold text-gray-800">Report Details</h3>
              <button onClick={() => { setSelectedReport(null); setReviewNotes('') }} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <h4 className="text-xl font-bold text-gray-800 mb-1">{selectedReport.title}</h4>
                <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                  <span>👤 {selectedReport.submittedBy?.fullName}</span>
                  <span>📅 {new Date(selectedReport.createdAt).toLocaleString()}</span>
                  {selectedReport.locationName && <span>📍 {selectedReport.locationName}</span>}
                  {selectedReport.zone?.name && <span>📍 Zone: {selectedReport.zone.name}</span>}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className={`rounded-xl p-3 text-center ${sev(selectedReport.analysis?.severityLevel).bg}`}>
                  <p className="text-xs text-gray-500">Severity</p>
                  <p className={`font-bold ${sev(selectedReport.analysis?.severityLevel).text}`}>{sev(selectedReport.analysis?.severityLevel).label}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500">Urgency</p>
                  <p className="text-2xl font-bold">{selectedReport.analysis?.urgencyScore || 0}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500">Category</p>
                  <p className="text-sm font-bold mt-1">{selectedReport.analysis?.category || 'N/A'}</p>
                </div>
              </div>

              {selectedReport.analysis?.summary && (
                <div className={`rounded-xl p-4 ${sev(selectedReport.analysis?.severityLevel).bg}`}>
                  <p className="text-xs font-semibold text-gray-600 mb-1">🤖 AI Summary</p>
                  <p className="text-sm text-gray-800 leading-relaxed">{selectedReport.analysis.summary}</p>
                </div>
              )}

              {selectedReport.analysis?.keyProblems?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-2">🔍 Key Problems</p>
                  <ul className="space-y-1">{selectedReport.analysis.keyProblems.map((p, i) => <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><span className="text-red-500">•</span>{p}</li>)}</ul>
                </div>
              )}

              {selectedReport.analysis?.suggestedActions?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-2">✅ Suggested Actions</p>
                  <ul className="space-y-1">{selectedReport.analysis.suggestedActions.map((a, i) => <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><span className="text-green-500">→</span>{a}</li>)}</ul>
                </div>
              )}

              {selectedReport.fileUrl && (
                <div className="border rounded-xl p-3">
                  {selectedReport.fileType === 'image' ? (
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-2">📷 Photo</p>
                      <img src={`${BASE_URL}${selectedReport.fileUrl}`} alt="report" className="w-full h-48 object-cover rounded-lg" />
                    </div>
                  ) : selectedReport.fileType === 'pdf' ? (
                    <a href={`${BASE_URL}${selectedReport.fileUrl}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-600 hover:underline font-medium">📄 Open PDF →</a>
                  ) : null}
                </div>
              )}

              {/* Review Actions */}
              {selectedReport.visibility === 'sent' && selectedReport.status === 'analyzed' && (
                <div className="border-t pt-4 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Review Notes</label>
                    <textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} placeholder="Add review notes..." rows={3}
                      className="w-full px-4 py-2.5 border rounded-xl text-sm resize-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <button onClick={() => handleReviewReport('reviewed')} disabled={reviewLoading} className="py-2.5 bg-blue-600 text-white text-sm rounded-xl font-medium disabled:opacity-50">👁️ Reviewed</button>
                    <button onClick={() => handleReviewReport('resolved')} disabled={reviewLoading} className="py-2.5 bg-green-600 text-white text-sm rounded-xl font-medium disabled:opacity-50">✅ Resolve</button>
                    <button onClick={() => handleReviewReport('rejected')} disabled={reviewLoading} className="py-2.5 bg-red-100 text-red-700 text-sm rounded-xl font-medium disabled:opacity-50">❌ Reject</button>
                  </div>
                </div>
              )}

              {(selectedReport.status !== 'analyzed' || selectedReport.visibility !== 'sent') && (
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className="text-sm text-gray-600">Status: <span className="font-bold">{selectedReport.status?.toUpperCase()}</span> • Visibility: <span className="font-bold">{selectedReport.visibility?.toUpperCase()}</span></p>
                  {selectedReport.reviewNotes && <p className="text-xs text-gray-500 mt-1 italic">Notes: "{selectedReport.reviewNotes}"</p>}
                  {selectedReport.reviewedBy && <p className="text-xs text-gray-400 mt-1">Reviewed by: {selectedReport.reviewedBy.fullName}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ DELETE REPORT CONFIRM ══ */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="text-center mb-4">
              <div className="text-5xl mb-3">🗑️</div>
              <h3 className="text-lg font-bold text-gray-800">Delete Report?</h3>
              <p className="text-sm text-gray-600 mt-2">This action cannot be undone.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl text-gray-600 font-medium">Cancel</button>
              <button onClick={() => handleDeleteReport(showDeleteConfirm)} disabled={actionLoading === showDeleteConfirm}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-medium disabled:opacity-50">
                {actionLoading === showDeleteConfirm ? 'Deleting...' : '🗑️ Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ CREATE ZONE MODAL ══ */}
      {showZoneModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold text-gray-800">📍 Create New Zone</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zone Name *</label>
                <input type="text" value={zoneForm.name} onChange={e => setZoneForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., North Delhi Zone" className="w-full px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500" />
                {zoneErrors.name && <p className="text-red-500 text-xs mt-1">{zoneErrors.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={zoneForm.description} onChange={e => setZoneForm(f => ({ ...f, description: e.target.value }))}
                  rows={2} className="w-full px-4 py-2.5 border rounded-xl text-sm resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">📍 Location *</label>
                <p className="text-xs text-gray-400 mb-2">Click on map to set zone center</p>
                <div ref={zoneMapContainer} className="w-full h-48 rounded-xl border" />
                {zoneErrors.location && <p className="text-red-500 text-xs mt-1">{zoneErrors.location}</p>}
              </div>
              {zoneForm.locationName && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                  <p className="text-sm font-medium text-green-800">✅ {zoneForm.locationName}</p>
                  <div className="flex gap-4 mt-1 text-xs text-green-500">
                    {zoneForm.city && <span>City: {zoneForm.city}</span>}
                    {zoneForm.state && <span>State: {zoneForm.state}</span>}
                    {zoneForm.pincode && <span>PIN: {zoneForm.pincode}</span>}
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => { setShowZoneModal(false); setZoneForm({ name: '', description: '', latitude: null, longitude: null, locationName: '', city: '', state: '', country: 'India', pincode: '' }); setZoneErrors({}) }}
                className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl text-gray-600 font-medium">Cancel</button>
              <button onClick={handleCreateZone} disabled={actionLoading === 'zone'} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-medium disabled:opacity-50">
                {actionLoading === 'zone' ? 'Creating...' : '📍 Create Zone'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}