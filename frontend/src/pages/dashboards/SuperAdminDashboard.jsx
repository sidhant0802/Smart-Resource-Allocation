import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { superAdminApi } from '../../api/authApi'

export default function SuperAdminDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [stats, setStats]                 = useState(null)
  const [ngos, setNgos]                   = useState([])
  const [loading, setLoading]             = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [declineModal, setDeclineModal]   = useState(null)
  const [declineReason, setDeclineReason] = useState('')
  const [filter, setFilter]               = useState('all')

  useEffect(() => {
    fetchData()
  }, [])

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

  const handleApprove = async (ngoId) => {
    setActionLoading(ngoId)
    try {
      await superAdminApi.approveNgo(ngoId)
      await fetchData()
    } catch (err) {
      alert('Failed to approve: ' + err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDecline = async () => {
    if (!declineModal) return
    setActionLoading(declineModal)
    try {
      await superAdminApi.declineNgo(declineModal, declineReason)
      setDeclineModal(null)
      setDeclineReason('')
      await fetchData()
    } catch (err) {
      alert('Failed to decline: ' + err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleSuspend = async (ngoId) => {
    if (!confirm('Are you sure you want to suspend this NGO?')) return
    setActionLoading(ngoId)
    try {
      await superAdminApi.suspendNgo(ngoId, 'Suspended by admin')
      await fetchData()
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

  const filteredNgos = ngos.filter(n => {
    if (filter === 'all') return true
    return n.status === filter
  })

  const statusColor = (status) => {
    const colors = {
      pending:   'bg-yellow-100 text-yellow-700',
      approved:  'bg-green-100 text-green-700',
      declined:  'bg-red-100 text-red-700',
      suspended: 'bg-gray-100 text-gray-700',
    }
    return colors[status] || 'bg-gray-100 text-gray-700'
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

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-3xl">👑</span>
          <div>
            <h1 className="font-bold text-gray-800">Super Admin</h1>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            Hi, {user?.fullName}
          </span>
          <button
            onClick={handleLogout}
            className="text-sm bg-red-50 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 font-medium"
          >
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-6">

        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          Platform Overview
        </h2>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
          {[
            { label: 'Total NGOs',   value: stats?.totalNgos   || 0, icon: '🏢', bg: 'bg-blue-50'   },
            { label: 'Pending NGOs', value: stats?.pendingNgos || 0, icon: '⏳', bg: 'bg-yellow-50' },
            { label: 'Active NGOs',  value: stats?.activeNgos  || 0, icon: '✅', bg: 'bg-green-50'  },
            { label: 'Total Users',  value: stats?.totalUsers  || 0, icon: '👥', bg: 'bg-purple-50' },
          ].map(card => (
            <div
              key={card.label}
              className={card.bg + ' rounded-2xl p-5 shadow-sm border border-gray-100'}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className="text-3xl font-bold text-gray-800 mt-1">
                    {card.value}
                  </p>
                </div>
                <span className="text-3xl">{card.icon}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-4">
          {['all', 'pending', 'approved', 'declined', 'suspended'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={
                filter === f
                  ? 'px-4 py-2 rounded-lg text-sm font-medium capitalize bg-blue-600 text-white'
                  : 'px-4 py-2 rounded-lg text-sm font-medium capitalize bg-white text-gray-600 border border-gray-200 hover:border-blue-200'
              }
            >
              {f}
              {f === 'pending' && stats?.pendingNgos > 0 && ` (${stats.pendingNgos})`}
            </button>
          ))}
        </div>

        {/* NGO List */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">
              NGO Management ({filteredNgos.length})
            </h3>
          </div>

          {filteredNgos.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-2">🏢</p>
              <p>No NGOs found for this filter</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredNgos.map(ngo => (
                <div
                  key={ngo._id}
                  className="p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">

                    {/* NGO Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="font-semibold text-gray-800 text-lg">
                          {ngo.name}
                        </h4>
                        <span
                          className={'text-xs px-2.5 py-1 rounded-full font-medium capitalize ' + statusColor(ngo.status)}
                        >
                          {ngo.status}
                        </span>
                      </div>

                      {ngo.description && (
                        <p className="text-sm text-gray-500 mb-2">
                          {ngo.description}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                        {ngo.managedBy && (
                          <span>👤 {ngo.managedBy.fullName}</span>
                        )}
                        {ngo.contactEmail && (
                          <span>📧 {ngo.contactEmail}</span>
                        )}
                        {ngo.website && (
                          <span>🌐 {ngo.website}</span>
                        )}
                        {ngo.locationName && (
                          <span>📍 {ngo.locationName}</span>
                        )}
                        <span>
                          📅 {new Date(ngo.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {ngo.declineReason && ngo.status !== 'approved' && (
                        <div className="mt-2 bg-red-50 rounded-lg p-2 text-xs text-red-600">
                          Reason: {ngo.declineReason}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 flex-shrink-0">
                      {ngo.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(ngo._id)}
                            disabled={actionLoading === ngo._id}
                            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
                          >
                            {actionLoading === ngo._id ? '...' : '✅ Approve'}
                          </button>
                          <button
                            onClick={() => setDeclineModal(ngo._id)}
                            disabled={actionLoading === ngo._id}
                            className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
                          >
                            ❌ Decline
                          </button>
                        </>
                      )}

                      {ngo.status === 'approved' && (
                        <button
                          onClick={() => handleSuspend(ngo._id)}
                          disabled={actionLoading === ngo._id}
                          className="px-4 py-2 bg-gray-600 text-white text-sm rounded-lg font-medium hover:bg-gray-700 disabled:opacity-50"
                        >
                          🚫 Suspend
                        </button>
                      )}

                      {ngo.status === 'declined' && (
                        <button
                          onClick={() => handleApprove(ngo._id)}
                          disabled={actionLoading === ngo._id}
                          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                          🔄 Re-approve
                        </button>
                      )}

                      {ngo.status === 'suspended' && (
                        <button
                          onClick={() => handleApprove(ngo._id)}
                          disabled={actionLoading === ngo._id}
                          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                          🔄 Reactivate
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Decline Reason Modal */}
      {declineModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              ❌ Decline NGO
            </h3>
            <p className="text-sm text-gray-500 mb-3">
              Please provide a reason for declining this NGO:
            </p>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Enter reason..."
              rows={3}
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
                disabled={actionLoading}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? 'Declining...' : 'Decline NGO'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}