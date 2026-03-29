import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { ngoManagerApi } from '../../api/authApi'
import mapboxgl from 'mapbox-gl'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

export default function NgoManagerDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [data, setData]                   = useState(null)
  const [loading, setLoading]             = useState(true)
  const [activeTab, setActiveTab]         = useState('overview')
  const [actionLoading, setActionLoading] = useState(null)

  // Zone creation
  const [showZoneModal, setShowZoneModal] = useState(false)
  const [zoneForm, setZoneForm]           = useState({
    name: '', description: '', latitude: null, longitude: null,
    locationName: '', city: '', state: '', country: 'India', pincode: '',
  })
  const [zoneErrors, setZoneErrors] = useState({})

  // Map
  const mapContainer = useRef(null)
  const map          = useRef(null)
  const zoneMarker   = useRef(null)

  // Zone map for modal
  const zoneMapContainer = useRef(null)
  const zoneMap          = useRef(null)
  const zoneMapMarker    = useRef(null)

  useEffect(() => {
    fetchDashboard()
  }, [])

  // Init main map after data loads
  useEffect(() => {
    if (!data || !mapContainer.current || map.current) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style:     'mapbox://styles/mapbox/light-v11',
      center:    [78.9629, 22.5937],
      zoom:      4,
    })

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')

    // Add zone markers
    if (data.zones && data.zones.length > 0) {
      const bounds = new mapboxgl.LngLatBounds()

      data.zones.forEach(zone => {
        if (zone.latitude && zone.longitude) {
          const el = document.createElement('div')
          el.className = 'zone-marker'
          el.style.cssText = 'width:32px;height:32px;background:#2563EB;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:14px;font-weight:bold;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);cursor:pointer;'
          el.innerHTML = '📍'

          const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div style="padding:8px;">
              <h3 style="font-weight:bold;font-size:14px;margin:0 0 4px 0;">${zone.name}</h3>
              <p style="font-size:12px;color:#666;margin:0;">${zone.locationName || ''}</p>
              <p style="font-size:11px;color:#999;margin:4px 0 0 0;">${zone.city || ''} ${zone.state || ''}</p>
            </div>
          `)

          new mapboxgl.Marker(el)
            .setLngLat([zone.longitude, zone.latitude])
            .setPopup(popup)
            .addTo(map.current)

          bounds.extend([zone.longitude, zone.latitude])
        }
      })

      if (data.zones.some(z => z.latitude && z.longitude)) {
        map.current.fitBounds(bounds, { padding: 60, maxZoom: 8 })
      }
    }

    // Add NGO HQ marker
    if (data.ngo?.location?.coordinates) {
      const [lng, lat] = data.ngo.location.coordinates
      if (lng && lat) {
        new mapboxgl.Marker({ color: '#DC2626' })
          .setLngLat([lng, lat])
          .setPopup(new mapboxgl.Popup().setHTML(`
            <div style="padding:8px;">
              <h3 style="font-weight:bold;font-size:14px;margin:0;">🏢 ${data.ngo.name}</h3>
              <p style="font-size:12px;color:#666;margin:4px 0 0 0;">NGO Headquarters</p>
            </div>
          `))
          .addTo(map.current)
      }
    }

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [data])

  const fetchDashboard = async () => {
    setLoading(true)
    try {
      const res = await ngoManagerApi.getDashboard()
      setData(res)
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Zone modal map
  useEffect(() => {
    if (!showZoneModal) return

    setTimeout(() => {
      if (!zoneMapContainer.current || zoneMap.current) return

      zoneMap.current = new mapboxgl.Map({
        container: zoneMapContainer.current,
        style:     'mapbox://styles/mapbox/streets-v12',
        center:    [78.9629, 22.5937],
        zoom:      4,
      })

      zoneMap.current.on('click', async (e) => {
        const { lng, lat } = e.lngLat
        if (zoneMapMarker.current) zoneMapMarker.current.remove()

        zoneMapMarker.current = new mapboxgl.Marker({ color: '#2563EB' })
          .setLngLat([lng, lat])
          .addTo(zoneMap.current)

        zoneMap.current.flyTo({ center: [lng, lat], zoom: 10 })

        try {
          const res = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxgl.accessToken}&language=en`
          )
          const geoData = await res.json()
          const feature = geoData.features?.[0]
          const context = feature?.context || []

          const city  = context.find(c => c.id.startsWith('place'))?.text || ''
          const state = context.find(c => c.id.startsWith('region'))?.text || ''
          const pin   = context.find(c => c.id.startsWith('postcode'))?.text || ''

          setZoneForm(prev => ({
            ...prev,
            latitude:     lat,
            longitude:    lng,
            locationName: feature?.place_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
            city,
            state,
            pincode: pin,
          }))
        } catch (err) {
          setZoneForm(prev => ({
            ...prev,
            latitude:     lat,
            longitude:    lng,
            locationName: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          }))
        }
      })
    }, 300)

    return () => {
      if (zoneMap.current) {
        zoneMap.current.remove()
        zoneMap.current = null
      }
    }
  }, [showZoneModal])

  const handleCreateZone = async () => {
    const errs = {}
    if (!zoneForm.name.trim()) errs.name = 'Zone name is required'
    if (!zoneForm.latitude)    errs.location = 'Select location on map'
    setZoneErrors(errs)
    if (Object.keys(errs).length > 0) return

    setActionLoading('zone')
    try {
      await ngoManagerApi.createZone(zoneForm)
      setShowZoneModal(false)
      setZoneForm({
        name: '', description: '', latitude: null, longitude: null,
        locationName: '', city: '', state: '', country: 'India', pincode: '',
      })
      // Refresh
      if (map.current) {
        map.current.remove()
        map.current = null
      }
      await fetchDashboard()
    } catch (err) {
      alert('Failed: ' + err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteZone = async (zoneId, zoneName) => {
    if (!confirm(`Delete zone "${zoneName}"? This cannot be undone.`)) return
    setActionLoading(zoneId)
    try {
      await ngoManagerApi.deleteZone(zoneId)
      if (map.current) {
        map.current.remove()
        map.current = null
      }
      await fetchDashboard()
    } catch (err) {
      alert('Failed: ' + err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleApproveCommittee = async (memberId, zoneId) => {
    setActionLoading(memberId)
    try {
      await ngoManagerApi.approveCommittee(memberId, zoneId)
      await fetchDashboard()
    } catch (err) {
      alert('Failed: ' + err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleApproveStaff = async (memberId, zoneId) => {
    setActionLoading(memberId)
    try {
      await ngoManagerApi.approveStaff(memberId, zoneId)
      await fetchDashboard()
    } catch (err) {
      alert('Failed: ' + err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDecline = async (memberId) => {
    if (!confirm('Decline this user?')) return
    setActionLoading(memberId)
    try {
      await ngoManagerApi.declineUser(memberId)
      await fetchDashboard()
    } catch (err) {
      alert('Failed: ' + err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

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

  // NGO not approved yet
  if (!data?.ngo || data.ngo.status !== 'approved') {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏢</span>
            <div>
              <h1 className="font-bold text-gray-800">NGO Manager</h1>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="text-sm bg-red-50 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 font-medium">
            Logout
          </button>
        </nav>
        <div className="max-w-lg mx-auto mt-20 text-center p-8">
          <div className="text-7xl mb-4">⏳</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">NGO Pending Approval</h2>
          <p className="text-gray-500">Your NGO is waiting for Super Admin approval. You will get full access once approved.</p>
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <p className="text-yellow-800 text-sm">
              NGO Name: <strong>{data?.ngo?.name || 'N/A'}</strong>
            </p>
            <p className="text-yellow-700 text-xs mt-1">
              Status: <strong className="uppercase">{data?.ngo?.status || 'pending'}</strong>
            </p>
          </div>
        </div>
      </div>
    )
  }

  const { ngo, stats, zones, pendingCommittee, pendingStaff, committeeMembers, ngoStaff, volunteers } = data
  const tabs = [
    { key: 'overview',   label: 'Overview',   icon: '📊' },
    { key: 'map',        label: 'Map View',   icon: '🗺️' },
    { key: 'zones',      label: 'Zones',      icon: '📍' },
    { key: 'team',       label: 'Team',       icon: '👥' },
    { key: 'approvals',  label: 'Approvals',  icon: '⏳', badge: stats.pendingApprovals },
  ]

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🏢</span>
          <div>
            <h1 className="font-bold text-gray-800">{ngo.name}</h1>
            <p className="text-xs text-gray-500">NGO Manager • {user?.fullName}</p>
          </div>
          <span className="bg-green-100 text-green-700 text-xs px-2.5 py-1 rounded-full font-medium ml-2">
            ✅ Approved
          </span>
        </div>
        <div className="flex items-center gap-4">
          {ngo.locationName && (
            <span className="text-xs text-gray-400 hidden md:block">
              📍 {ngo.locationName}
            </span>
          )}
          <button onClick={handleLogout} className="text-sm bg-red-50 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 font-medium">
            Logout
          </button>
        </div>
      </nav>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={
                activeTab === tab.key
                  ? 'px-4 py-3 text-sm font-medium border-b-2 border-blue-600 text-blue-600 flex items-center gap-2'
                  : 'px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 flex items-center gap-2'
              }
            >
              <span>{tab.icon}</span>
              {tab.label}
              {tab.badge > 0 && (
                <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">

        {/* ══════ OVERVIEW TAB ══════ */}
        {activeTab === 'overview' && (
          <div>
            {/* NGO Info Card */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white mb-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{ngo.name}</h2>
                  {ngo.description && (
                    <p className="text-blue-100 mt-1 text-sm max-w-lg">{ngo.description}</p>
                  )}
                  <div className="flex flex-wrap gap-4 mt-3 text-xs text-blue-200">
                    {ngo.contactEmail && <span>📧 {ngo.contactEmail}</span>}
                    {ngo.website && <span>🌐 {ngo.website}</span>}
                    {ngo.locationName && <span>📍 {ngo.locationName}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-blue-200 text-xs">Member since</p>
                  <p className="text-sm font-medium">
                    {new Date(ngo.createdAt).toLocaleDateString('en-IN', {
                      year: 'numeric', month: 'long', day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              {[
                { label: 'Zones',            value: stats.totalZones,            icon: '📍', bg: 'bg-blue-50',   color: 'text-blue-600' },
                { label: 'Committee',         value: stats.totalCommitteeMembers, icon: '👥', bg: 'bg-purple-50', color: 'text-purple-600' },
                { label: 'Staff',             value: stats.totalStaff,            icon: '📋', bg: 'bg-orange-50', color: 'text-orange-600' },
                { label: 'Volunteers',        value: stats.totalVolunteers,       icon: '🙋', bg: 'bg-green-50',  color: 'text-green-600' },
                { label: 'Pending Approvals', value: stats.pendingApprovals,      icon: '⏳', bg: 'bg-red-50',    color: 'text-red-600' },
              ].map(card => (
                <div key={card.label} className={'rounded-2xl p-4 shadow-sm border border-gray-100 ' + card.bg}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500">{card.label}</p>
                      <p className={'text-2xl font-bold mt-1 ' + card.color}>{card.value}</p>
                    </div>
                    <span className="text-2xl">{card.icon}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Map Preview */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">🗺️ Zone Map</h3>
                <button
                  onClick={() => setActiveTab('map')}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Full Map View →
                </button>
              </div>
              <div ref={mapContainer} className="w-full h-80" />
            </div>

            {/* Recent Zones */}
            {zones.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-800">📍 Your Zones</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {zones.slice(0, 5).map(zone => (
                    <div key={zone._id} className="p-4 px-6 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-800">{zone.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {zone.city && zone.city + ', '}{zone.state || zone.locationName || ''}
                        </p>
                      </div>
                      <span className={zone.status === 'active' ? 'text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full' : 'text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full'}>
                        {zone.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════ MAP TAB ══════ */}
        {activeTab === 'map' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-800">Operations Map</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  🔴 NGO HQ &nbsp;&nbsp; 🔵 Zone Locations
                </p>
              </div>
              <span className="text-sm text-gray-500">{zones.length} zones</span>
            </div>
            <div ref={activeTab === 'map' && !map.current ? mapContainer : undefined} className="w-full h-[500px]">
              {!map.current && (
                <div className="h-full flex items-center justify-center text-gray-400">
                  <p>Switch to Overview tab first to load map, then come back</p>
                </div>
              )}
            </div>

            {/* Zone List below map */}
            <div className="border-t border-gray-100 divide-y divide-gray-100">
              {zones.map(zone => (
                <div key={zone._id} className="p-4 px-6 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📍</span>
                    <div>
                      <p className="font-medium text-gray-800">{zone.name}</p>
                      <p className="text-xs text-gray-500">
                        {zone.city}{zone.state ? ', ' + zone.state : ''} {zone.pincode ? '- ' + zone.pincode : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Committee: {zone.committeeMembers?.length || 0}</p>
                    <p className="text-xs text-gray-400">{zone.locationName}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════ ZONES TAB ══════ */}
        {activeTab === 'zones' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">Zones ({zones.length})</h3>
              <button
                onClick={() => setShowZoneModal(true)}
                className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
              >
                ➕ Create Zone
              </button>
            </div>

            {zones.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
                <p className="text-5xl mb-3">📍</p>
                <h3 className="text-lg font-semibold text-gray-800">No zones yet</h3>
                <p className="text-gray-500 text-sm mt-1">Create your first zone to start operations</p>
                <button
                  onClick={() => setShowZoneModal(true)}
                  className="mt-4 bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700"
                >
                  ➕ Create First Zone
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {zones.map(zone => (
                  <div key={zone._id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-800 text-lg">{zone.name}</h4>
                        {zone.description && (
                          <p className="text-sm text-gray-500 mt-0.5">{zone.description}</p>
                        )}
                      </div>
                      <span className={zone.status === 'active' ? 'text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium' : 'text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium'}>
                        {zone.status}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-gray-500 mb-4">
                      {zone.locationName && <p>📍 {zone.locationName}</p>}
                      {(zone.city || zone.state) && (
                        <p>🏙️ {zone.city}{zone.state ? ', ' + zone.state : ''} {zone.pincode}</p>
                      )}
                      <p>👥 Committee Members: {zone.committeeMembers?.length || 0}</p>
                      <p>📅 Created: {new Date(zone.createdAt).toLocaleDateString()}</p>
                    </div>

                    {/* Committee members in this zone */}
                    {zone.committeeMembers?.length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-3 mb-3">
                        <p className="text-xs font-medium text-gray-600 mb-2">Committee Members:</p>
                        {zone.committeeMembers.map(m => (
                          <div key={m._id} className="flex items-center gap-2 text-xs text-gray-600 mb-1">
                            <span className={m.status === 'active' ? 'w-2 h-2 bg-green-500 rounded-full' : 'w-2 h-2 bg-gray-400 rounded-full'} />
                            <span>{m.fullName}</span>
                            <span className="text-gray-400">({m.email})</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={() => handleDeleteZone(zone._id, zone.name)}
                      disabled={actionLoading === zone._id}
                      className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
                    >
                      🗑️ Delete Zone
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════ TEAM TAB ══════ */}
        {activeTab === 'team' && (
          <div className="space-y-6">
            {/* Committee Members */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800">👥 Committee Members ({committeeMembers.length})</h3>
              </div>
              {committeeMembers.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <p>No committee members yet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {committeeMembers.map(m => (
                    <div key={m._id} className="p-4 px-6 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-lg">
                          👤
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{m.fullName}</p>
                          <p className="text-xs text-gray-500">{m.email} • {m.phone}</p>
                          {m.locationName && <p className="text-xs text-gray-400">📍 {m.locationName}</p>}
                        </div>
                      </div>
                      <span className={m.status === 'active' ? 'text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full' : 'text-xs bg-yellow-100 text-yellow-700 px-2.5 py-1 rounded-full'}>
                        {m.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* NGO Staff */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800">📋 NGO Staff ({ngoStaff.length})</h3>
              </div>
              {ngoStaff.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <p>No staff members yet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {ngoStaff.map(s => (
                    <div key={s._id} className="p-4 px-6 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-lg">
                          📋
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{s.fullName}</p>
                          <p className="text-xs text-gray-500">{s.email} • {s.phone}</p>
                          {s.locationName && <p className="text-xs text-gray-400">📍 {s.locationName}</p>}
                        </div>
                      </div>
                      <span className={s.status === 'active' ? 'text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full' : 'text-xs bg-yellow-100 text-yellow-700 px-2.5 py-1 rounded-full'}>
                        {s.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Volunteers */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800">🙋 Volunteers ({volunteers.length})</h3>
              </div>
              {volunteers.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <p>No volunteers yet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {volunteers.map(v => (
                    <div key={v._id} className="p-4 px-6 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-lg">
                          🙋
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{v.fullName}</p>
                          <p className="text-xs text-gray-500">{v.email}</p>
                          {v.volunteerProfile?.skills?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {v.volunteerProfile.skills.slice(0, 3).map(s => (
                                <span key={s} className="bg-blue-50 text-blue-600 text-xs px-2 py-0.5 rounded-full">{s}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className={v.status === 'active' ? 'text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full' : 'text-xs bg-yellow-100 text-yellow-700 px-2.5 py-1 rounded-full'}>
                        {v.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════ APPROVALS TAB ══════ */}
        {activeTab === 'approvals' && (
          <div className="space-y-6">

            {/* Pending Committee Members */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800">
                  👥 Pending Committee Members ({pendingCommittee.length})
                </h3>
              </div>
              {pendingCommittee.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <p>✅ No pending committee approvals</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {pendingCommittee.map(m => (
                    <div key={m._id} className="p-5 px-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-gray-800">{m.fullName}</p>
                          <p className="text-sm text-gray-500">{m.email} • {m.phone}</p>
                          {m.locationName && (
                            <p className="text-xs text-gray-400 mt-1">📍 {m.locationName}</p>
                          )}
                          <p className="text-xs text-gray-400">
                            Applied: {new Date(m.createdAt).toLocaleDateString()}
                          </p>

                          {/* Zone selection */}
                          <div className="mt-3">
                            <label className="text-xs font-medium text-gray-600">Assign to Zone:</label>
                            <select
                              id={'zone-' + m._id}
                              className="ml-2 px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">-- Select Zone --</option>
                              {zones.map(z => (
                                <option key={z._id} value={z._id}>{z.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const zoneId = document.getElementById('zone-' + m._id)?.value
                              handleApproveCommittee(m._id, zoneId)
                            }}
                            disabled={actionLoading === m._id}
                            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
                          >
                            {actionLoading === m._id ? '...' : '✅ Approve'}
                          </button>
                          <button
                            onClick={() => handleDecline(m._id)}
                            disabled={actionLoading === m._id}
                            className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
                          >
                            ❌ Decline
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pending Staff */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800">
                  📋 Pending Staff ({pendingStaff.length})
                </h3>
              </div>
              {pendingStaff.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <p>✅ No pending staff approvals</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {pendingStaff.map(s => (
                    <div key={s._id} className="p-5 px-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-gray-800">{s.fullName}</p>
                          <p className="text-sm text-gray-500">{s.email} • {s.phone}</p>
                          {s.locationName && (
                            <p className="text-xs text-gray-400 mt-1">📍 {s.locationName}</p>
                          )}

                          <div className="mt-3">
                            <label className="text-xs font-medium text-gray-600">Assign to Zone:</label>
                            <select
                              id={'staff-zone-' + s._id}
                              className="ml-2 px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">-- Select Zone --</option>
                              {zones.map(z => (
                                <option key={z._id} value={z._id}>{z.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const zoneId = document.getElementById('staff-zone-' + s._id)?.value
                              handleApproveStaff(s._id, zoneId)
                            }}
                            disabled={actionLoading === s._id}
                            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
                          >
                            {actionLoading === s._id ? '...' : '✅ Approve'}
                          </button>
                          <button
                            onClick={() => handleDecline(s._id)}
                            disabled={actionLoading === s._id}
                            className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
                          >
                            ❌ Decline
                          </button>
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

      {/* ══════ CREATE ZONE MODAL ══════ */}
      {showZoneModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">📍 Create New Zone</h3>
              <p className="text-sm text-gray-500 mt-0.5">Define an operational zone for your NGO</p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zone Name *</label>
                <input
                  type="text"
                  value={zoneForm.name}
                  onChange={(e) => setZoneForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., North Delhi Zone"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {zoneErrors.name && (
                  <p className="text-red-500 text-xs mt-1">{zoneErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={zoneForm.description}
                  onChange={(e) => setZoneForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="What area does this zone cover?"
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">📍 Zone Location *</label>
                <p className="text-xs text-gray-400 mb-2">Click on the map to set zone center</p>
                <div ref={zoneMapContainer} className="w-full h-48 rounded-xl border border-gray-200" />
                {zoneErrors.location && (
                  <p className="text-red-500 text-xs mt-1">{zoneErrors.location}</p>
                )}
              </div>

              {zoneForm.locationName && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                  <p className="text-sm font-medium text-green-800">✅ Location Selected</p>
                  <p className="text-xs text-green-600 mt-0.5">{zoneForm.locationName}</p>
                  <div className="flex gap-4 mt-1 text-xs text-green-500">
                    {zoneForm.city && <span>City: {zoneForm.city}</span>}
                    {zoneForm.state && <span>State: {zoneForm.state}</span>}
                    {zoneForm.pincode && <span>PIN: {zoneForm.pincode}</span>}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => {
                  setShowZoneModal(false)
                  setZoneForm({
                    name: '', description: '', latitude: null, longitude: null,
                    locationName: '', city: '', state: '', country: 'India', pincode: '',
                  })
                  setZoneErrors({})
                }}
                className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl text-gray-600 font-medium hover:border-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateZone}
                disabled={actionLoading === 'zone'}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading === 'zone' ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Creating...
                  </>
                ) : (
                  '📍 Create Zone'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}