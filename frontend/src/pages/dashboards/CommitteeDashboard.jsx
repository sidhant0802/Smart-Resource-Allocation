import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { reportApi } from '../../api/authApi'

const SEVERITY_CONFIG = {
  critical: { bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-500',    label: '🔴 CRITICAL',  bar: 'bg-red-500'    },
  high:     { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-500', label: '🟠 HIGH',      bar: 'bg-orange-500' },
  medium:   { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-500', label: '🟡 MEDIUM',    bar: 'bg-yellow-500' },
  low:      { bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-500',  label: '🟢 LOW',       bar: 'bg-green-500'  },
  info:     { bg: 'bg-gray-100',   text: 'text-gray-700',   border: 'border-gray-300',   label: '⚪ INFO',      bar: 'bg-gray-400'   },
}

export default function CommitteeDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab]   = useState('reports')
  const [reports, setReports]       = useState([])
  const [stats, setStats]           = useState(null)
  const [loading, setLoading]       = useState(true)
  const [selectedReport, setSelectedReport] = useState(null)
  const [reviewLoading, setReviewLoading]   = useState(false)
  const [reviewNotes, setReviewNotes]       = useState('')

  // Filters
  const [filterSeverity, setFilterSeverity] = useState('')
  const [filterStatus, setFilterStatus]     = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (activeTab === 'reports') fetchReports()
  }, [activeTab, filterSeverity, filterStatus])

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

  const tabs = [
    { key: 'reports',  label: 'Reports',   icon: '📊' },
    { key: 'critical', label: 'Critical',  icon: '🔴' },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="text-gray-500 mt-4">Loading reports...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-3xl">👥</span>
          <div>
            <h1 className="font-bold text-gray-800">Committee Member</h1>
            <p className="text-xs text-gray-500">{user?.fullName} • Zone Dashboard</p>
          </div>
        </div>
        <button onClick={handleLogout} className="text-sm bg-red-50 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 font-medium">
          Logout
        </button>
      </nav>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={activeTab === tab.key
                ? 'px-4 py-3 text-sm font-medium border-b-2 border-blue-600 text-blue-600 flex items-center gap-2'
                : 'px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 flex items-center gap-2'
              }
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            {[
              { label: 'Total',    value: stats.total,    bg: 'bg-blue-50',   text: 'text-blue-700'   },
              { label: 'Critical', value: stats.critical, bg: 'bg-red-50',    text: 'text-red-700'    },
              { label: 'High',     value: stats.high,     bg: 'bg-orange-50', text: 'text-orange-700' },
              { label: 'Pending',  value: stats.pending,  bg: 'bg-yellow-50', text: 'text-yellow-700' },
              { label: 'Resolved', value: stats.resolved, bg: 'bg-green-50',  text: 'text-green-700'  },
            ].map(s => (
              <div key={s.label} className={`rounded-2xl p-4 shadow-sm ${s.bg}`}>
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className={`text-2xl font-bold mt-1 ${s.text}`}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3 mb-5">
          <select
            value={filterSeverity}
            onChange={e => setFilterSeverity(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value="analyzed">Pending Review</option>
            <option value="reviewed">Reviewed</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        {/* Reports List */}
        {reports.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
            <p className="text-5xl mb-3">📊</p>
            <p className="text-gray-500">No reports found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports
              .filter(r => activeTab === 'critical'
                ? ['critical', 'high'].includes(r.analysis?.severityLevel)
                : true
              )
              .map(report => (
                <div
                  key={report._id}
                  className={`bg-white rounded-2xl shadow-sm border-l-4 overflow-hidden ${sev(report.analysis?.severityLevel).border}`}
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">

                      {/* Left: Report Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-gray-800">{report.title}</h4>
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${sev(report.analysis?.severityLevel).bg} ${sev(report.analysis?.severityLevel).text}`}>
                            {sev(report.analysis?.severityLevel).label}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-3 text-xs text-gray-400 mb-3">
                          <span>👤 {report.submittedBy?.fullName}</span>
                          <span>📅 {new Date(report.createdAt).toLocaleString()}</span>
                          <span>📁 {report.fileType?.toUpperCase() || 'TEXT'}</span>
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
                        {/* File proof */}
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
                            📄 View PDF Proof
                          </a>
                        )}

                        {/* Review Actions */}
                        {report.status === 'analyzed' && (
                          <button
                            onClick={() => setSelectedReport(report)}
                            className="px-3 py-2 bg-blue-600 text-white text-xs rounded-lg font-medium hover:bg-blue-700"
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

      {/* Review Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className={`p-5 border-b ${sev(selectedReport.analysis?.severityLevel).bg}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-gray-800">{selectedReport.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${sev(selectedReport.analysis?.severityLevel).bg} ${sev(selectedReport.analysis?.severityLevel).text}`}>
                      {sev(selectedReport.analysis?.severityLevel).label}
                    </span>
                    <span className="text-xs text-gray-500">
                      Score: {selectedReport.analysis?.urgencyScore}/100
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedReport(null)}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Submitted by */}
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>👤</span>
                <span><strong>{selectedReport.submittedBy?.fullName}</strong> • {selectedReport.submittedBy?.email}</span>
              </div>

              {/* AI Summary */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-medium text-gray-500 mb-2">🤖 AI Analysis Summary</p>
                <p className="text-sm text-gray-800 leading-relaxed">
                  {selectedReport.analysis?.summary}
                </p>
              </div>

              {/* Score breakdown */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500">Urgency Score</p>
                  <p className="text-2xl font-bold text-gray-800">{selectedReport.analysis?.urgencyScore}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500">Category</p>
                  <p className="text-sm font-bold text-gray-800">{selectedReport.analysis?.category}</p>
                </div>
              </div>

              {/* Extracted text */}
              {selectedReport.originalText && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">📝 Extracted Content</p>
                  <div className="bg-gray-50 rounded-xl p-3 max-h-32 overflow-y-auto">
                    <p className="text-xs text-gray-700 leading-relaxed">
                      {selectedReport.originalText.substring(0, 500)}
                      {selectedReport.originalText.length > 500 ? '...' : ''}
                    </p>
                  </div>
                </div>
              )}

              {/* File proof */}
              {selectedReport.fileUrl && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">📎 Proof Document</p>
                  {selectedReport.fileType === 'image' ? (
                    <img
                      src={`http://localhost:5000${selectedReport.fileUrl}`}
                      alt="proof"
                      className="w-full rounded-xl border border-gray-200 max-h-48 object-contain"
                    />
                  ) : selectedReport.fileType === 'pdf' ? (
                    <a
                      href={`http://localhost:5000${selectedReport.fileUrl}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-blue-600 bg-blue-50 border border-blue-200 rounded-xl p-3 hover:bg-blue-100"
                    >
                      📄 Open PDF Document
                    </a>
                  ) : null}
                </div>
              )}

              {/* Review Notes */}
              {selectedReport.status === 'analyzed' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Review Notes
                  </label>
                  <textarea
                    value={reviewNotes}
                    onChange={e => setReviewNotes(e.target.value)}
                    placeholder="Add your observations or action plan..."
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              )}

              {/* Actions */}
              {selectedReport.status === 'analyzed' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleReview('reviewed')}
                    disabled={reviewLoading}
                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {reviewLoading ? '...' : '✅ Mark Reviewed'}
                  </button>
                  <button
                    onClick={() => handleReview('resolved')}
                    disabled={reviewLoading}
                    className="flex-1 py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    {reviewLoading ? '...' : '🎯 Mark Resolved'}
                  </button>
                  <button
                    onClick={() => handleReview('rejected')}
                    disabled={reviewLoading}
                    className="py-2.5 px-4 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 disabled:opacity-50"
                  >
                    ❌
                  </button>
                </div>
              )}

              {selectedReport.reviewNotes && (
                <div className="bg-blue-50 rounded-xl p-3">
                  <p className="text-xs font-medium text-gray-500">Review Notes:</p>
                  <p className="text-sm text-gray-700 mt-1">{selectedReport.reviewNotes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}