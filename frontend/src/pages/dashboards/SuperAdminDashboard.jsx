import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { superAdminApi } from '../../api/authApi'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

export default function SuperAdminDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab]         = useState('overview')
  const [stats, setStats]                 = useState(null)
  const [ngos, setNgos]                   = useState([])
  const [loading, setLoading]             = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [declineModal, setDeclineModal]   = useState(null)
  const [declineReason, setDeclineReason] = useState('')
  const [filter, setFilter]               = useState('all')
  const [searchQuery, setSearchQuery]     = useState('')
  const [sortBy, setSortBy]               = useState('newest')
  const [selectedNgo, setSelectedNgo]     = useState(null)
  const [timeRange, setTimeRange]         = useState('all')

  // Analytics
  const [analyticsData, setAnalyticsData] = useState(null)
  const [chartData, setChartData]         = useState(null)

  // Map
  const mapContainer = useRef(null)
  const map          = useRef(null)

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (activeTab === 'analytics') {
      fetchAnalytics()
    }
  }, [activeTab, timeRange])

  useEffect(() => {
    if (activeTab === 'map' && !map.current && mapContainer.current && ngos.length > 0) {
      initMap()
    }
  }, [activeTab, ngos])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [statsRes, ngosRes] = await Promise.all([
        superAdminApi.getStats(),
        superAdminApi.getAllNgos(),
      ])
      setStats(statsRes.stats)
      setNgos(ngosRes.ngos)
    } catch (err) {
      console.error('Failed to fetch data:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchAnalytics = async () => {
    try {
      // TODO: Replace with actual API call
      const mockAnalytics = {
        ngoGrowth: [
          { month: 'Jan', count: 5 },
          { month: 'Feb', count: 8 },
          { month: 'Mar', count: 12 },
          { month: 'Apr', count: 15 },
          { month: 'May', count: 18 },
          { month: 'Jun', count: 22 },
        ],
        userGrowth: [
          { month: 'Jan', count: 45 },
          { month: 'Feb', count: 78 },
          { month: 'Mar', count: 112 },
          { month: 'Apr', count: 156 },
          { month: 'May', count: 189 },
          { month: 'Jun', count: 234 },
        ],
        topNgos: [
          { name: 'Relief Foundation', zones: 5, members: 42, reports: 156 },
          { name: 'HealthCare NGO', zones: 3, members: 28, reports: 98 },
          { name: 'Education First', zones: 4, members: 35, reports: 87 },
        ],
        categoryBreakdown: [
          { category: 'Healthcare', count: 8 },
          { category: 'Education', count: 6 },
          { category: 'Environment', count: 4 },
          { category: 'Food Security', count: 3 },
          { category: 'Disaster Relief', count: 2 },
        ]
      }
      setAnalyticsData(mockAnalytics)
    } catch (err) {
      console.error('Failed to fetch analytics:', err)
    }
  }

  const initMap = () => {
    if (!mapContainer.current || map.current) return

    const ngosWithLocation = ngos.filter(n => n.location?.coordinates)
    if (ngosWithLocation.length === 0) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [78.9629, 22.5937],
      zoom: 4,
    })

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')

    const bounds = new mapboxgl.LngLatBounds()

    ngosWithLocation.forEach(ngo => {
      const [lng, lat] = ngo.location.coordinates
      
      const markerColor = {
        approved: '#10B981',
        pending: '#F59E0B',
        declined: '#EF4444',
        suspended: '#6B7280'
      }[ngo.status] || '#6B7280'

      const el = document.createElement('div')
      el.className = 'ngo-marker'
      el.style.cssText = `
        width:40px;
        height:40px;
        background:${markerColor};
        border-radius:50%;
        display:flex;
        align-items:center;
        justify-content:center;
        color:white;
        font-size:18px;
        font-weight:bold;
        border:3px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,0.3);
        cursor:pointer;
      `
      el.innerHTML = '🏢'

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div style="padding:10px;min-width:220px;">
          <h3 style="font-weight:bold;font-size:14px;margin:0 0 6px 0;">${ngo.name}</h3>
          <div style="background:#f3f4f6;padding:6px 8px;border-radius:6px;margin-bottom:6px;">
            <p style="font-size:11px;color:#666;margin:0;">Status: <strong style="text-transform:capitalize;color:${markerColor}">${ngo.status}</strong></p>
          </div>
          ${ngo.description ? `<p style="font-size:11px;color:#666;margin:0 0 6px 0;">${ngo.description.substring(0, 80)}...</p>` : ''}
          <div style="font-size:10px;color:#999;">
            ${ngo.locationName ? `📍 ${ngo.locationName}` : ''}
          </div>
        </div>
      `)

      el.addEventListener('click', () => {
        setSelectedNgo(ngo)
        setActiveTab('ngos')
      })

      new mapboxgl.Marker(el)
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(map.current)

      bounds.extend([lng, lat])
    })

    if (ngosWithLocation.length > 0) {
      map.current.fitBounds(bounds, { padding: 60, maxZoom: 8 })
    }
  }

  const handleApprove = async (ngoId) => {
    setActionLoading(ngoId)
    try {
      await superAdminApi.approveNgo(ngoId)
      await fetchData()
      alert('✅ NGO approved successfully!')
    } catch (err) {
      alert('Failed to approve: ' + err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDecline = async () => {
    if (!declineModal || !declineReason.trim()) {
      alert('Please provide a reason for declining')
      return
    }
    setActionLoading(declineModal)
    try {
      await superAdminApi.declineNgo(declineModal, declineReason)
      setDeclineModal(null)
      setDeclineReason('')
      await fetchData()
      alert('❌ NGO declined')
    } catch (err) {
      alert('Failed to decline: ' + err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleSuspend = async (ngoId) => {
    const reason = prompt('Enter reason for suspension:')
    if (!reason) return
    
    setActionLoading(ngoId)
    try {
      await superAdminApi.suspendNgo(ngoId, reason)
      await fetchData()
      alert('🚫 NGO suspended')
    } catch (err) {
      alert('Failed to suspend: ' + err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const filteredNgos = ngos
    .filter(n => {
      if (filter !== 'all' && n.status !== filter) return false
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return (
          n.name.toLowerCase().includes(query) ||
          n.description?.toLowerCase().includes(query) ||
          n.contactEmail?.toLowerCase().includes(query) ||
          n.locationName?.toLowerCase().includes(query)
        )
      }
      return true
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt) - new Date(a.createdAt)
        case 'oldest':
          return new Date(a.createdAt) - new Date(b.createdAt)
        case 'name':
          return a.name.localeCompare(b.name)
        default:
          return 0
      }
    })

  const statusColor = (status) => {
    const colors = {
      pending:   'bg-yellow-100 text-yellow-700 border-yellow-300',
      approved:  'bg-green-100 text-green-700 border-green-300',
      declined:  'bg-red-100 text-red-700 border-red-300',
      suspended: 'bg-gray-100 text-gray-700 border-gray-300',
    }
    return colors[status] || 'bg-gray-100 text-gray-700 border-gray-300'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="text-gray-500 mt-4">Loading Super Admin Dashboard...</p>
        </div>
      </div>
    )
  }

  const tabs = [
    { key: 'overview',   label: 'Overview',   icon: '📊' },
    { key: 'ngos',       label: 'NGOs',       icon: '🏢', badge: stats?.pendingNgos },
    { key: 'analytics',  label: 'Analytics',  icon: '📈' },
    { key: 'map',        label: 'Map View',   icon: '🗺️' },
    { key: 'users',      label: 'Users',      icon: '👥' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Navbar */}
      <nav className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-2xl">
                👑
              </div>
              <div>
                <h1 className="font-bold text-white text-lg">Super Admin Portal</h1>
                <p className="text-xs text-indigo-100">Platform Management & Analytics</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-white bg-opacity-20 rounded-xl">
              <span className="text-sm text-white font-medium">
                {user?.fullName}
              </span>
              <span className="text-xs text-indigo-100">{user?.email}</span>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-white text-indigo-600 rounded-xl text-sm font-medium hover:bg-indigo-50"
            >
              Logout
            </button>
          </div>
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
                  ? 'px-5 py-3 text-sm font-medium border-b-2 border-indigo-600 text-indigo-600 flex items-center gap-2 whitespace-nowrap'
                  : 'px-5 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 flex items-center gap-2 whitespace-nowrap'
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
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Platform Overview</h2>
              <p className="text-gray-500 text-sm mt-1">Monitor and manage all NGOs and users</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
              {[
                { 
                  label: 'Total NGOs', 
                  value: stats?.totalNgos || 0, 
                  icon: '🏢', 
                  bg: 'bg-gradient-to-br from-blue-500 to-blue-600',
                  change: '+12%',
                  trend: 'up'
                },
                { 
                  label: 'Pending Approvals', 
                  value: stats?.pendingNgos || 0, 
                  icon: '⏳', 
                  bg: 'bg-gradient-to-br from-yellow-500 to-orange-500',
                  urgent: stats?.pendingNgos > 0
                },
                { 
                  label: 'Active NGOs', 
                  value: stats?.activeNgos || 0, 
                  icon: '✅', 
                  bg: 'bg-gradient-to-br from-green-500 to-emerald-600',
                  change: '+8%',
                  trend: 'up'
                },
                { 
                  label: 'Total Users', 
                  value: stats?.totalUsers || 0, 
                  icon: '👥', 
                  bg: 'bg-gradient-to-br from-purple-500 to-pink-600',
                  change: '+15%',
                  trend: 'up'
                },
              ].map(card => (
                <div
                  key={card.label}
                  className={`${card.bg} rounded-2xl p-5 shadow-lg text-white relative overflow-hidden`}
                >
                  {card.urgent && (
                    <div className="absolute top-2 right-2">
                      <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </div>
                  )}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-sm opacity-90">{card.label}</p>
                      <p className="text-4xl font-bold mt-1">{card.value}</p>
                    </div>
                    <span className="text-4xl opacity-80">{card.icon}</span>
                  </div>
                  {card.change && (
                    <div className="flex items-center gap-1 text-xs opacity-90">
                      <span>{card.trend === 'up' ? '↗' : '↘'}</span>
                      <span>{card.change} from last month</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <span>⚡</span> Quick Actions
                </h3>
                <div className="space-y-3">
                  {stats?.pendingNgos > 0 && (
                    <button
                      onClick={() => setActiveTab('ngos')}
                      className="w-full flex items-center justify-between px-4 py-3 bg-yellow-50 hover:bg-yellow-100 rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">⏳</span>
                        <div className="text-left">
                          <p className="font-medium text-gray-800 text-sm">Review Pending NGOs</p>
                          <p className="text-xs text-gray-500">{stats.pendingNgos} awaiting approval</p>
                        </div>
                      </div>
                      <span className="text-yellow-600">→</span>
                    </button>
                  )}
                  <button
                    onClick={() => setActiveTab('analytics')}
                    className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">📈</span>
                      <div className="text-left">
                        <p className="font-medium text-gray-800 text-sm">View Analytics</p>
                        <p className="text-xs text-gray-500">Platform insights & trends</p>
                      </div>
                    </div>
                    <span className="text-blue-600">→</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('map')}
                    className="w-full flex items-center justify-between px-4 py-3 bg-green-50 hover:bg-green-100 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🗺️</span>
                      <div className="text-left">
                        <p className="font-medium text-gray-800 text-sm">Geographic View</p>
                        <p className="text-xs text-gray-500">NGO distribution map</p>
                      </div>
                    </div>
                    <span className="text-green-600">→</span>
                  </button>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <span>📋</span> Recent NGO Activity
                </h3>
                <div className="space-y-3">
                  {ngos.slice(0, 4).map(ngo => (
                    <div key={ngo._id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg">
                      <div className={`w-2 h-2 rounded-full ${
                        ngo.status === 'approved' ? 'bg-green-500' :
                        ngo.status === 'pending' ? 'bg-yellow-500' :
                        ngo.status === 'declined' ? 'bg-red-500' :
                        'bg-gray-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{ngo.name}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(ngo.createdAt).toLocaleDateString()} • {ngo.status}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Platform Health */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span>💚</span> Platform Health
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-3xl mb-2">
                    {stats?.activeNgos > 0 ? '🟢' : '🟡'}
                  </div>
                  <p className="text-sm font-medium text-gray-800">System Status</p>
                  <p className="text-xs text-gray-500">
                    {stats?.activeNgos > 0 ? 'Operational' : 'No Active NGOs'}
                  </p>
                </div>
                <div className="text-center">
                  <div className="text-3xl mb-2">📊</div>
                  <p className="text-sm font-medium text-gray-800">Data Quality</p>
                  <p className="text-xs text-gray-500">98% Complete</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl mb-2">
                    {stats?.pendingNgos > 5 ? '🟡' : '🟢'}
                  </div>
                  <p className="text-sm font-medium text-gray-800">Approval Queue</p>
                  <p className="text-xs text-gray-500">
                    {stats?.pendingNgos > 5 ? 'High Load' : 'Normal'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════ NGOS TAB ══════ */}
        {activeTab === 'ngos' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">NGO Management</h2>
                <p className="text-gray-500 text-sm mt-1">Review, approve, and manage all NGOs</p>
              </div>
            </div>

            {/* Filters & Search */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
              <div className="grid md:grid-cols-3 gap-4">
                {/* Search */}
                <div className="md:col-span-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by name, email, location..."
                      className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="absolute left-3 top-3 text-gray-400">🔍</span>
                  </div>
                </div>

                {/* Sort */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="name">Name (A-Z)</option>
                </select>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                {[
                  { key: 'all', label: 'All NGOs', count: ngos.length },
                  { key: 'pending', label: 'Pending', count: stats?.pendingNgos || 0 },
                  { key: 'approved', label: 'Approved', count: stats?.activeNgos || 0 },
                  { key: 'declined', label: 'Declined', count: ngos.filter(n => n.status === 'declined').length },
                  { key: 'suspended', label: 'Suspended', count: ngos.filter(n => n.status === 'suspended').length },
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium capitalize whitespace-nowrap flex items-center gap-2 ${
                      filter === f.key
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {f.label}
                    {f.count > 0 && (
                      <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                        filter === f.key ? 'bg-white text-indigo-600' : 'bg-gray-200 text-gray-700'
                      }`}>
                        {f.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* NGO List */}
            {filteredNgos.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                <p className="text-5xl mb-3">🔍</p>
                <h3 className="text-lg font-semibold text-gray-800">No NGOs found</h3>
                <p className="text-gray-500 text-sm mt-1">
                  {searchQuery ? 'Try different search terms' : 'No NGOs match the selected filter'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredNgos.map(ngo => (
                  <div
                    key={ngo._id}
                    className={`bg-white rounded-2xl shadow-sm border-l-4 overflow-hidden hover:shadow-md transition-shadow ${
                      ngo.status === 'approved' ? 'border-l-green-500' :
                      ngo.status === 'pending' ? 'border-l-yellow-500' :
                      ngo.status === 'declined' ? 'border-l-red-500' :
                      'border-l-gray-400'
                    } ${selectedNgo?._id === ngo._id ? 'ring-2 ring-indigo-500' : ''}`}
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-4">

                        {/* NGO Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center text-white text-xl">
                              🏢
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-bold text-gray-800 text-lg">
                                  {ngo.name}
                                </h4>
                                <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize border ${statusColor(ngo.status)}`}>
                                  {ngo.status}
                                </span>
                              </div>
                              {ngo.description && (
                                <p className="text-sm text-gray-600 line-clamp-1">
                                  {ngo.description}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="grid md:grid-cols-2 gap-x-6 gap-y-2 mt-3 text-sm">
                            {ngo.managedBy && (
                              <div className="flex items-center gap-2 text-gray-600">
                                <span>👤</span>
                                <span className="font-medium">{ngo.managedBy.fullName}</span>
                              </div>
                            )}
                            {ngo.contactEmail && (
                              <div className="flex items-center gap-2 text-gray-600">
                                <span>📧</span>
                                <span className="truncate">{ngo.contactEmail}</span>
                              </div>
                            )}
                            {ngo.website && (
                              <div className="flex items-center gap-2 text-gray-600">
                                <span>🌐</span>
                                <a href={ngo.website} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline truncate">
                                  {ngo.website}
                                </a>
                              </div>
                            )}
                            {ngo.locationName && (
                              <div className="flex items-center gap-2 text-gray-600">
                                <span>📍</span>
                                <span className="truncate">{ngo.locationName}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-gray-600">
                              <span>📅</span>
                              <span>Registered: {new Date(ngo.createdAt).toLocaleDateString()}</span>
                            </div>
                            {ngo.stats && (
                              <div className="flex items-center gap-2 text-gray-600">
                                <span>👥</span>
                                <span>{ngo.stats.totalMembers || 0} members</span>
                              </div>
                            )}
                          </div>

                          {ngo.declineReason && ngo.status === 'declined' && (
                            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                              <p className="text-xs font-semibold text-red-800 mb-1">Decline Reason:</p>
                              <p className="text-sm text-red-600">{ngo.declineReason}</p>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2 flex-shrink-0">
                          {ngo.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApprove(ngo._id)}
                                disabled={actionLoading === ngo._id}
                                className="px-5 py-2.5 bg-green-600 text-white text-sm rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                              >
                                {actionLoading === ngo._id ? (
                                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                ) : (
                                  <>✅ Approve</>
                                )}
                              </button>
                              <button
                                onClick={() => setDeclineModal(ngo._id)}
                                disabled={actionLoading === ngo._id}
                                className="px-5 py-2.5 bg-red-600 text-white text-sm rounded-xl font-medium hover:bg-red-700 disabled:opacity-50 whitespace-nowrap"
                              >
                                ❌ Decline
                              </button>
                            </>
                          )}

                          {ngo.status === 'approved' && (
                            <button
                              onClick={() => handleSuspend(ngo._id)}
                              disabled={actionLoading === ngo._id}
                              className="px-5 py-2.5 bg-gray-600 text-white text-sm rounded-xl font-medium hover:bg-gray-700 disabled:opacity-50 whitespace-nowrap"
                            >
                              🚫 Suspend
                            </button>
                          )}

                          {(ngo.status === 'declined' || ngo.status === 'suspended') && (
                            <button
                              onClick={() => handleApprove(ngo._id)}
                              disabled={actionLoading === ngo._id}
                              className="px-5 py-2.5 bg-indigo-600 text-white text-sm rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap"
                            >
                              🔄 Reactivate
                            </button>
                          )}

                          <button
                            onClick={() => setSelectedNgo(ngo)}
                            className="px-5 py-2.5 bg-gray-100 text-gray-700 text-sm rounded-xl font-medium hover:bg-gray-200 whitespace-nowrap"
                          >
                            👁️ Details
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════ ANALYTICS TAB ══════ */}
        {activeTab === 'analytics' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Platform Analytics</h2>
                <p className="text-gray-500 text-sm mt-1">Insights, trends, and performance metrics</p>
              </div>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="90days">Last 90 Days</option>
                <option value="all">All Time</option>
              </select>
            </div>

            {/* Growth Charts */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <span>📈</span> NGO Growth
                </h3>
                <div className="h-64 flex items-end gap-2">
                  {analyticsData?.ngoGrowth?.map((item, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-full bg-gradient-to-t from-indigo-500 to-indigo-400 rounded-t-lg transition-all hover:from-indigo-600 hover:to-indigo-500"
                        style={{ height: `${(item.count / 25) * 100}%` }}
                      />
                      <p className="text-xs text-gray-500 mt-2">{item.month}</p>
                      <p className="text-xs font-semibold text-gray-700">{item.count}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <span>👥</span> User Growth
                </h3>
                <div className="h-64 flex items-end gap-2">
                  {analyticsData?.userGrowth?.map((item, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-full bg-gradient-to-t from-purple-500 to-pink-400 rounded-t-lg transition-all hover:from-purple-600 hover:to-pink-500"
                        style={{ height: `${(item.count / 250) * 100}%` }}
                      />
                      <p className="text-xs text-gray-500 mt-2">{item.month}</p>
                      <p className="text-xs font-semibold text-gray-700">{item.count}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Top NGOs & Categories */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <span>🏆</span> Top Performing NGOs
                </h3>
                <div className="space-y-3">
                  {analyticsData?.topNgos?.map((ngo, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        #{i + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-800 text-sm">{ngo.name}</p>
                        <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
                          <span>📍 {ngo.zones} zones</span>
                          <span>👥 {ngo.members} members</span>
                          <span>📋 {ngo.reports} reports</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <span>📊</span> NGO Categories
                </h3>
                <div className="space-y-2">
                  {analyticsData?.categoryBreakdown?.map((cat, i) => {
                    const maxCount = Math.max(...analyticsData.categoryBreakdown.map(c => c.count))
                    const percentage = (cat.count / maxCount) * 100
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-700">{cat.category}</span>
                          <span className="font-semibold text-gray-800">{cat.count}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════ MAP TAB ══════ */}
        {activeTab === 'map' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Geographic Distribution</h2>
              <p className="text-gray-500 text-sm mt-1">
                🟢 Approved • 🟡 Pending • 🔴 Declined • ⚪ Suspended
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div ref={mapContainer} className="w-full h-[600px]" />
            </div>
          </div>
        )}

        {/* ══════ USERS TAB ══════ */}
        {activeTab === 'users' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800">User Management</h2>
              <p className="text-gray-500 text-sm mt-1">Coming soon...</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
              <p className="text-5xl mb-3">👥</p>
              <p className="text-gray-500">User management features will be available soon</p>
            </div>
          </div>
        )}
      </div>

      {/* ══════ DECLINE MODAL ══════ */}
      {declineModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              ❌ Decline NGO
            </h3>
            <p className="text-sm text-gray-500 mb-3">
              Please provide a detailed reason for declining this NGO application:
            </p>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="E.g., Incomplete documentation, duplicate registration..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setDeclineModal(null)
                  setDeclineReason('')
                }}
                className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl text-gray-600 font-medium hover:border-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleDecline}
                disabled={!declineReason.trim() || actionLoading}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? 'Declining...' : 'Decline NGO'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ NGO DETAILS MODAL ══════ */}
      {selectedNgo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 sticky top-0 bg-white">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">{selectedNgo.name}</h3>
                  <span className={`inline-block mt-1 text-xs px-2.5 py-1 rounded-full font-medium capitalize border ${statusColor(selectedNgo.status)}`}>
                    {selectedNgo.status}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedNgo(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {selectedNgo.description && (
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">Description</p>
                  <p className="text-sm text-gray-800">{selectedNgo.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">Contact Email</p>
                  <p className="text-sm text-gray-800">{selectedNgo.contactEmail || '—'}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">Website</p>
                  <p className="text-sm text-gray-800">{selectedNgo.website || '—'}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">Location</p>
                  <p className="text-sm text-gray-800">{selectedNgo.locationName || '—'}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">Registered</p>
                  <p className="text-sm text-gray-800">
                    {new Date(selectedNgo.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {selectedNgo.managedBy && (
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">Manager</p>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                      <span className="text-indigo-600 font-bold">
                        {selectedNgo.managedBy.fullName.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{selectedNgo.managedBy.fullName}</p>
                      <p className="text-xs text-gray-500">{selectedNgo.managedBy.email}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}