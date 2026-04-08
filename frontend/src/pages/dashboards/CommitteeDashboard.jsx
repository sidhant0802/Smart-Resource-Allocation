import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { reportApi } from '../../api/authApi'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

const SEVERITY_CONFIG = {
  critical: { bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-500',    label: '🔴 CRITICAL',  bar: 'bg-red-500',    color: '#EF4444' },
  high:     { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-500', label: '🟠 HIGH',      bar: 'bg-orange-500', color: '#F59E0B' },
  medium:   { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-500', label: '🟡 MEDIUM',    bar: 'bg-yellow-500', color: '#FBBF24' },
  low:      { bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-500',  label: '🟢 LOW',       bar: 'bg-green-500',  color: '#10B981' },
  info:     { bg: 'bg-gray-100',   text: 'text-gray-700',   border: 'border-gray-300',   label: '⚪ INFO',      bar: 'bg-gray-400',   color: '#6B7280' },
}

export default function CommitteeDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab]   = useState('overview')
  const [reports, setReports]       = useState([])
  const [stats, setStats]           = useState(null)
  const [loading, setLoading]       = useState(true)
  const [selectedReport, setSelectedReport] = useState(null)
  const [reviewLoading, setReviewLoading]   = useState(false)
  const [reviewNotes, setReviewNotes]       = useState('')

  // Filters
  const [filterSeverity, setFilterSeverity] = useState('')
  const [filterStatus, setFilterStatus]     = useState('')
  const [searchQuery, setSearchQuery]       = useState('')

  // Map
  const mapContainer = useRef(null)
  const map          = useRef(null)

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (activeTab === 'reports') fetchReports()
  }, [activeTab, filterSeverity, filterStatus])

  useEffect(() => {
    if (activeTab === 'map' && !map.current && mapContainer.current && reports.length > 0) {
      initMap()
    }
  }, [activeTab, reports])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [reportsRes, statsRes] = await Promise.all([
        reportApi.getZoneReports({
          severity: filterSeverity || undefined,
          status:   filterStatus   || undefined,
        }),
        reportApi.getZoneStats(),
      ])
      setReports(reportsRes.reports || [])
      setStats(statsRes.stats)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchReports = async () => {
    try {
      const res = await reportApi.getZoneReports({
        severity: filterSeverity || undefined,
        status:   filterStatus   || undefined,
      })
      setReports(res.reports || [])
    } catch (err) {
      console.error(err)
    }
  }

  const initMap = () => {
    if (!mapContainer.current || map.current) return

    const reportsWithLocation = reports.filter(r => r.location?.coordinates)
    if (reportsWithLocation.length === 0) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: user?.location?.coordinates || [78.9629, 22.5937],
      zoom: 10,
    })

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')

    const bounds = new mapboxgl.LngLatBounds()

    reportsWithLocation.forEach(report => {
      const [lng, lat] = report.location.coordinates
      const severity = report.analysis?.severityLevel || 'info'
      const markerColor = SEVERITY_CONFIG[severity]?.color || '#6B7280'

      const el = document.createElement('div')
      el.style.cssText = `
        width:36px;
        height:36px;
        background:${markerColor};
        border-radius:50%;
        display:flex;
        align-items:center;
        justify-content:center;
        color:white;
        font-size:16px;
        border:3px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,0.3);
        cursor:pointer;
      `
      el.innerHTML = severity === 'critical' ? '🔥' : '📍'

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div style="padding:10px;min-width:220px;">
          <h3 style="font-weight:bold;font-size:14px;margin:0 0 4px 0;">${report.title}</h3>
          <div style="background:#f3f4f6;padding:4px 8px;border-radius:6px;margin-bottom:6px;">
            <p style="font-size:11px;margin:0;">
              ${SEVERITY_CONFIG[severity]?.label || 'INFO'} • ${report.analysis?.urgencyScore || 0}/100
            </p>
          </div>
          <p style="font-size:11px;color:#666;margin:0 0 4px 0;">
            ${report.analysis?.category || 'Uncategorized'}
          </p>
          <p style="font-size:10px;color:#999;margin:0;">
            ${new Date(report.createdAt).toLocaleDateString()}
          </p>
        </div>
      `)

      el.addEventListener('click', () => {
        setSelectedReport(report)
        setActiveTab('reports')
      })

      new mapboxgl.Marker(el)
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(map.current)

      bounds.extend([lng, lat])
    })

    if (reportsWithLocation.length > 0) {
      map.current.fitBounds(bounds, { padding: 60, maxZoom: 12 })
    }

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }

  const handleReview = async (status) => {
    if (!selectedReport) return
    setReviewLoading(true)
    try {
      await reportApi.reviewReport(selectedReport._id, {
        status,
        reviewNotes,
      })
      setSelectedReport(null)
      setReviewNotes('')
      fetchData()
      alert(`✅ Report marked as ${status}`)
    } catch (err) {
      alert('Failed: ' + err.message)
    } finally {
      setReviewLoading(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const sev = (level) => SEVERITY_CONFIG[level] || SEVERITY_CONFIG.info

  const filteredReports = reports.filter(r => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        r.title.toLowerCase().includes(query) ||
        r.analysis?.category?.toLowerCase().includes(query) ||
        r.submittedBy?.fullName?.toLowerCase().includes(query)
      )
    }
    return true
  })

  const tabs = [
    { key: 'overview',  label: 'Overview',  icon: '📊' },
    { key: 'reports',   label: 'Reports',   icon: '📋', badge: stats?.total },
    { key: 'critical',  label: 'Critical',  icon: '🔴', badge: stats?.critical },
    { key: 'map',       label: 'Map View',  icon: '🗺️' },
    { key: 'analytics', label: 'Analytics', icon: '📈' },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="text-gray-500 mt-4">Loading committee dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Navbar */}
      <nav className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-2xl">
              👥
            </div>
            <div>
              <h1 className="font-bold text-white text-lg">Committee Dashboard</h1>
              <p className="text-xs text-purple-100">
                {user?.fullName} • {user?.assignedZone?.name || 'Zone Committee Member'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-white bg-opacity-20 rounded-xl">
              <span className="text-white text-sm font-medium">
                📍 {user?.assignedZone?.name || 'Assigned Zone'}
              </span>
            </div>
            <button 
              onClick={handleLogout} 
              className="px-4 py-2 bg-white text-purple-600 rounded-xl text-sm font-medium hover:bg-purple-50"
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
                  ? 'px-5 py-3 text-sm font-medium border-b-2 border-purple-600 text-purple-600 flex items-center gap-2 whitespace-nowrap'
                  : 'px-5 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 flex items-center gap-2 whitespace-nowrap'
              }
            >
              <span>{tab.icon}</span>
              {tab.label}
              {tab.badge > 0 && (
                <span className="bg-purple-500 text-white text-xs px-1.5 py-0.5 rounded-full">
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
              <h2 className="text-2xl font-bold text-gray-800">Zone Overview</h2>
              <p className="text-gray-500 text-sm mt-1">
                Monitor and review reports from your assigned zone
              </p>
            </div>

            {/* Stats Grid */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                {[
                  { label: 'Total Reports',    value: stats.total,    icon: '📊', bg: 'bg-blue-50',   text: 'text-blue-700'   },
                  { label: 'Critical',          value: stats.critical, icon: '🔴', bg: 'bg-red-50',    text: 'text-red-700'    },
                  { label: 'High Priority',     value: stats.high,     icon: '🟠', bg: 'bg-orange-50', text: 'text-orange-700' },
                  { label: 'Pending Review',    value: stats.pending,  icon: '⏳', bg: 'bg-yellow-50', text: 'text-yellow-700' },
                  { label: 'Resolved',          value: stats.resolved, icon: '✅', bg: 'bg-green-50',  text: 'text-green-700'  },
                ].map(s => (
                  <div key={s.label} className={`rounded-2xl p-4 shadow-sm border border-gray-100 ${s.bg}`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-500">{s.label}</p>
                      <span className="text-2xl">{s.icon}</span>
                    </div>
                    <p className={`text-3xl font-bold ${s.text}`}>{s.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Recent Critical Reports */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-red-50">
                  <h3 className="font-semibold text-red-800 flex items-center gap-2">
                    <span>🔴</span> Critical Reports Requiring Attention
                  </h3>
                </div>
                <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                  {reports
                    .filter(r => r.analysis?.severityLevel === 'critical' && r.status === 'analyzed')
                    .slice(0, 5)
                    .map(report => (
                      <div
                        key={report._id}
                        onClick={() => setSelectedReport(report)}
                        className="p-4 hover:bg-gray-50 cursor-pointer"
                      >
                        <p className="font-medium text-gray-800 text-sm mb-1">{report.title}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>⚡ {report.analysis?.urgencyScore}/100</span>
                          <span>•</span>
                          <span>📅 {new Date(report.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  {reports.filter(r => r.analysis?.severityLevel === 'critical' && r.status === 'analyzed').length === 0 && (
                    <div className="p-8 text-center text-gray-400">
                      <p className="text-sm">✅ No critical reports pending</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <span>📋</span> Recent Activity
                  </h3>
                </div>
                <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                  {reports.slice(0, 6).map(report => (
                    <div key={report._id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-1 ${
                          report.analysis?.severityLevel === 'critical' ? 'bg-red-500' :
                          report.analysis?.severityLevel === 'high' ? 'bg-orange-500' :
                          report.analysis?.severityLevel === 'medium' ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`} />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800">{report.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {report.submittedBy?.fullName} • {new Date(report.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl p-6 border border-purple-200">
              <h3 className="font-semibold text-gray-800 mb-4">⚡ Quick Actions</h3>
              <div className="grid md:grid-cols-3 gap-4">
                <button
                  onClick={() => setActiveTab('critical')}
                  className="flex items-center gap-3 p-4 bg-white rounded-xl hover:shadow-md transition-shadow"
                >
                  <span className="text-2xl">🔴</span>
                  <div className="text-left">
                    <p className="font-medium text-gray-800 text-sm">Review Critical</p>
                    <p className="text-xs text-gray-500">{stats?.critical || 0} reports</p>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('map')}
                  className="flex items-center gap-3 p-4 bg-white rounded-xl hover:shadow-md transition-shadow"
                >
                  <span className="text-2xl">🗺️</span>
                  <div className="text-left">
                    <p className="font-medium text-gray-800 text-sm">View on Map</p>
                    <p className="text-xs text-gray-500">Geographic view</p>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('analytics')}
                  className="flex items-center gap-3 p-4 bg-white rounded-xl hover:shadow-md transition-shadow"
                >
                  <span className="text-2xl">📈</span>
                  <div className="text-left">
                    <p className="font-medium text-gray-800 text-sm">View Analytics</p>
                    <p className="text-xs text-gray-500">Trends & insights</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════ REPORTS TAB ══════ */}
        {(activeTab === 'reports' || activeTab === 'critical') && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                {activeTab === 'critical' ? 'Critical Reports' : 'All Reports'}
              </h2>
              <p className="text-gray-500 text-sm mt-1">
                Review and take action on submitted reports
              </p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-5">
              <div className="relative flex-1 min-w-[200px]">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search reports..."
                  className="w-full px-4 py-2 pl-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
              </div>

              <select
                value={filterSeverity}
                onChange={e => setFilterSeverity(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">All Severity</option>
                <option value="critical">🔴 Critical</option>
                <option value="high">🟠 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>

              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">All Status</option>
                <option value="analyzed">⏳ Pending Review</option>
                <option value="reviewed">👁️ Reviewed</option>
                <option value="resolved">✅ Resolved</option>
              </select>
            </div>

            {/* Reports List */}
            {filteredReports
              .filter(r => activeTab === 'critical'
                ? ['critical', 'high'].includes(r.analysis?.severityLevel)
                : true
              )
              .length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
                <p className="text-5xl mb-3">📊</p>
                <p className="text-gray-500">No reports found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredReports
                  .filter(r => activeTab === 'critical'
                    ? ['critical', 'high'].includes(r.analysis?.severityLevel)
                    : true
                  )
                  .map(report => (
                    <div
                      key={report._id}
                      className={`bg-white rounded-2xl shadow-sm border-l-4 overflow-hidden hover:shadow-md transition-shadow ${sev(report.analysis?.severityLevel).border}`}
                    >
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-4">

                          {/* Left: Report Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold text-gray-800 text-lg">{report.title}</h4>
                              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${sev(report.analysis?.severityLevel).bg} ${sev(report.analysis?.severityLevel).text}`}>
                                {sev(report.analysis?.severityLevel).label}
                              </span>
                              {report.analysis?.immediateRisk && (
                                <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium animate-pulse">
                                  ⚠️ IMMEDIATE RISK
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-3 text-xs text-gray-400 mb-3">
                              <span>👤 {report.submittedBy?.fullName}</span>
                              <span>📅 {new Date(report.createdAt).toLocaleString()}</span>
                              {report.locationName && <span>📍 {report.locationName}</span>}
                              <span className={`font-medium ${
                                report.status === 'analyzed'  ? 'text-purple-600' :
                                report.status === 'reviewed'  ? 'text-blue-600' :
                                report.status === 'resolved'  ? 'text-green-600' :
                                'text-gray-500'
                              }`}>
                                {report.status?.toUpperCase()}
                              </span>
                            </div>

                            {/* Urgency Bar */}
                            <div className="flex items-center gap-3 mb-3">
                              <span className="text-xs text-gray-500 w-24">Urgency Score</span>
                              <div className="flex-1 bg-gray-100 rounded-full h-3">
                                <div
                                  className={`h-3 rounded-full transition-all ${sev(report.analysis?.severityLevel).bar}`}
                                  style={{ width: `${report.analysis?.urgencyScore || 0}%` }}
                                />
                              </div>
                              <span className="text-sm font-bold text-gray-700 w-14 text-right">
                                {report.analysis?.urgencyScore || 0}/100
                              </span>
                            </div>

                            {/* AI Summary */}
                            {report.analysis?.summary && (
                              <div className={`rounded-xl p-3 mb-3 ${sev(report.analysis?.severityLevel).bg}`}>
                                <p className="text-xs font-medium text-gray-600 mb-1">🤖 AI Summary</p>
                                <p className="text-sm text-gray-800 leading-relaxed">
                                  {report.analysis.summary}
                                </p>
                              </div>
                            )}

                            {/* Keywords & Category */}
                            <div className="flex flex-wrap gap-1.5">
                              {report.analysis?.category && (
                                <span className="bg-blue-100 text-blue-700 text-xs px-2.5 py-1 rounded-full font-medium">
                                  📂 {report.analysis.category}
                                </span>
                              )}
                              {report.analysis?.keywords?.slice(0, 4).map(kw => (
                                <span key={kw} className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                                  {kw}
                                </span>
                              ))}
                              {report.analysis?.affectedPeople && (
                                <span className="bg-red-100 text-red-600 text-xs px-2.5 py-1 rounded-full">
                                  👥 ~{report.analysis.affectedPeople} people
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Right: File Proof + Actions */}
                          <div className="flex flex-col gap-2 flex-shrink-0 w-36">
                            {report.fileUrl && report.fileType === 'image' && (
                              <div className="border border-gray-200 rounded-xl overflow-hidden">
                                <img
                                  src={`http://localhost:5000${report.fileUrl}`}
                                  alt="proof"
                                  className="w-full h-24 object-cover"
                                />
                                <p className="text-xs text-center text-gray-500 py-1">📷 Photo Proof</p>
                              </div>
                            )}

                            {report.fileUrl && report.fileType === 'pdf' && (
                              <a
                                href={`http://localhost:5000${report.fileUrl}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg p-2 hover:bg-blue-100"
                              >
                                📄 View PDF
                              </a>
                            )}

                            {report.status === 'analyzed' && (
                              <button
                                onClick={() => setSelectedReport(report)}
                                className="px-3 py-2 bg-purple-600 text-white text-xs rounded-lg font-medium hover:bg-purple-700"
                              >
                                Review Report
                              </button>
                            )}

                            {report.status !== 'analyzed' && (
                              <button
                                onClick={() => setSelectedReport(report)}
                                className="px-3 py-2 bg-gray-100 text-gray-600 text-xs rounded-lg font-medium hover:bg-gray-200"
                              >
                                View Details
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* ══════ MAP TAB ══════ */}
        {activeTab === 'map' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Geographic View</h2>
              <p className="text-gray-500 text-sm mt-1">
                Reports plotted on map by location • Click markers for details
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div ref={mapContainer} className="w-full h-[600px]" />
            </div>
          </div>
        )}

        {/* ══════ ANALYTICS TAB ══════ */}
        {activeTab === 'analytics' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Analytics & Insights</h2>
              <p className="text-gray-500 text-sm mt-1">
                Trends and patterns in your zone
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
              <p className="text-5xl mb-3">📊</p>
              <p className="text-gray-500">Analytics coming soon...</p>
            </div>
          </div>
        )}
      </div>

      {/* Review Modal - Keep your existing modal code */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          {/* Your existing modal content */}
        </div>
      )}
    </div>
  )
}