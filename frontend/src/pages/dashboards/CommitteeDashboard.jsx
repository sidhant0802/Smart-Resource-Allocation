import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { reportApi, taskApi } from '../../api/authApi'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

const SEVERITY_CONFIG = {
  critical: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    border: 'border-red-500',
    label: '🔴 CRITICAL',
    bar: 'bg-red-500',
    color: '#EF4444',
  },
  high: {
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    border: 'border-orange-500',
    label: '🟠 HIGH',
    bar: 'bg-orange-500',
    color: '#F59E0B',
  },
  medium: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-700',
    border: 'border-yellow-500',
    label: '🟡 MEDIUM',
    bar: 'bg-yellow-500',
    color: '#FBBF24',
  },
  low: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    border: 'border-green-500',
    label: '🟢 LOW',
    bar: 'bg-green-500',
    color: '#10B981',
  },
  info: {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    border: 'border-gray-300',
    label: '⚪ INFO',
    bar: 'bg-gray-400',
    color: '#6B7280',
  },
}

const TASK_CATEGORIES = [
  'Food Security',
  'Healthcare',
  'Education',
  'Environment',
  'Disaster Relief',
  'Community Development',
]

const BASE_URL =
  import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000'

export default function CommitteeDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // ── State ────────────────────────────────────
  const [activeTab, setActiveTab] = useState('overview')
  const [reports, setReports] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedReport, setSelectedReport] = useState(null)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewNotes, setReviewNotes] = useState('')
  const [successMsg, setSuccessMsg] = useState(null)

  // Filters
  const [filterSeverity, setFilterSeverity] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Staff & Volunteers
  const [staff, setStaff] = useState([])
  const [staffLoading, setStaffLoading] = useState(false)
  const [volunteerApps, setVolunteerApps] = useState([])
  const [volAppsLoading, setVolAppsLoading] = useState(false)
  const [volAppFilter, setVolAppFilter] = useState('')
  const [approvedVolunteers, setApprovedVolunteers] = useState([])
  const [approvedVolLoading, setApprovedVolLoading] = useState(false)
  const [reviewAppLoading, setReviewAppLoading] = useState(null)

  // Tasks
  const [tasks, setTasks] = useState([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [taskFilter, setTaskFilter] = useState('')
  const [showCreateTask, setShowCreateTask] = useState(null)
  const [createTaskLoading, setCreateTaskLoading] = useState(false)
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    category: 'Community Development',
    volunteersNeeded: 3,
    startDate: new Date().toISOString().split('T')[0],
    duration: 3,
    skillsRequired: '',
    affectedPeople: 0,
  })

  // Task volunteer review
  const [pendingTaskApps, setPendingTaskApps] = useState([])
  const [pendingTaskLoading, setPendingTaskLoading] = useState(false)
  const [taskReviewLoading, setTaskReviewLoading] = useState(null)

  // Duration edit
  const [editDuration, setEditDuration] = useState(null)
  const [newDuration, setNewDuration] = useState(0)

  // Profile
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)

  // Maps
  const mapContainer = useRef(null)
  const map = useRef(null)
  const taskMapContainer = useRef(null)
  const taskMap = useRef(null)

  const showSuccess = (msg) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 3000)
  }
  const sev = (l) => SEVERITY_CONFIG[l] || SEVERITY_CONFIG.info

  // ── Data Fetchers ────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [reportsRes, statsRes] = await Promise.all([
        reportApi.getZoneReports({}),
        reportApi.getZoneStats(),
      ])
      setReports(reportsRes.reports || [])
      setStats(statsRes.stats)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchReports = async () => {
    try {
      const res = await reportApi.getZoneReports({
        severity: filterSeverity || undefined,
        status: filterStatus || undefined,
      })
      setReports(res.reports || [])
    } catch (err) {
      console.error(err)
    }
  }

  const fetchStaff = async () => {
    setStaffLoading(true)
    try {
      const res = await reportApi.getZoneStaff()
      setStaff(res.staff || [])
    } catch (err) {
      console.error(err)
    } finally {
      setStaffLoading(false)
    }
  }

  const fetchVolunteerApps = async () => {
    setVolAppsLoading(true)
    try {
      const res = await reportApi.getVolunteerApplications({
        status: volAppFilter || undefined,
      })
      setVolunteerApps(res.applications || [])
    } catch (err) {
      console.error(err)
    } finally {
      setVolAppsLoading(false)
    }
  }

  const fetchApprovedVolunteers = async () => {
    setApprovedVolLoading(true)
    try {
      const res = await reportApi.getApprovedVolunteers()
      setApprovedVolunteers(res.volunteers || [])
    } catch (err) {
      console.error(err)
    } finally {
      setApprovedVolLoading(false)
    }
  }

  const fetchTasks = async () => {
    setTasksLoading(true)
    try {
      const res = await reportApi.getZoneTasks({
        status: taskFilter || undefined,
      })
      setTasks(res.tasks || [])
    } catch (err) {
      console.error(err)
    } finally {
      setTasksLoading(false)
    }
  }

  const fetchPendingTaskApps = async () => {
    setPendingTaskLoading(true)
    try {
      const res = await taskApi.getPendingApplications()
      setPendingTaskApps(res.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setPendingTaskLoading(false)
    }
  }

  const fetchProfile = async () => {
    setProfileLoading(true)
    try {
      const res = await reportApi.getCommitteeProfile()
      setProfile(res.profile)
    } catch (err) {
      console.error(err)
    } finally {
      setProfileLoading(false)
    }
  }

  // ── Effects ──────────────────────────────────
  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (activeTab === 'reports' || activeTab === 'critical') fetchReports()
    if (activeTab === 'people') {
      fetchStaff()
      fetchVolunteerApps()
      fetchApprovedVolunteers()
    }
    if (activeTab === 'tasks') {
      fetchTasks()
      fetchPendingTaskApps()
      fetchApprovedVolunteers()
    }
    if (activeTab === 'profile') fetchProfile()
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'reports' || activeTab === 'critical') fetchReports()
  }, [filterSeverity, filterStatus])

  useEffect(() => {
    if (activeTab === 'people') fetchVolunteerApps()
  }, [volAppFilter])

  useEffect(() => {
    if (activeTab === 'tasks') fetchTasks()
  }, [taskFilter])

  // ── Report Map ───────────────────────────────
  useEffect(() => {
    if (activeTab !== 'map' || !mapContainer.current || map.current) return
    const withLoc = reports.filter(
      (r) => r.location?.coordinates || (r.latitude && r.longitude)
    )
    if (withLoc.length === 0 && !mapContainer.current) return

    const center = user?.location?.coordinates ||
      user?.coordinates
        ? [
            user.coordinates?.lng || user.location?.coordinates?.[0] || 78.9629,
            user.coordinates?.lat || user.location?.coordinates?.[1] || 22.5937,
          ]
        : [78.9629, 22.5937]

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center,
      zoom: 10,
    })
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')

    if (withLoc.length > 0) {
      const bounds = new mapboxgl.LngLatBounds()
      withLoc.forEach((report) => {
        const lng =
          report.location?.coordinates?.[0] || report.longitude
        const lat =
          report.location?.coordinates?.[1] || report.latitude
        if (!lng || !lat) return
        const severity = report.analysis?.severityLevel || 'info'
        const markerColor = SEVERITY_CONFIG[severity]?.color || '#6B7280'

        const el = document.createElement('div')
        el.style.cssText = `width:32px;height:32px;background:${markerColor};border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:14px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);cursor:pointer;`
        el.textContent = severity === 'critical' ? '🔥' : '📍'

        new mapboxgl.Marker(el)
          .setLngLat([lng, lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(`
              <div style="padding:8px;min-width:200px;">
                <h3 style="font-weight:bold;font-size:13px;margin:0 0 4px;">${report.title}</h3>
                <p style="font-size:11px;color:#666;margin:0 0 2px;">${SEVERITY_CONFIG[severity]?.label} • ${report.analysis?.urgencyScore || 0}/100</p>
                <p style="font-size:10px;color:#999;margin:0;">${report.analysis?.category || 'N/A'} • ${new Date(report.createdAt).toLocaleDateString()}</p>
              </div>
            `)
          )
          .addTo(map.current)
        bounds.extend([lng, lat])
      })
      if (withLoc.length > 1)
        map.current.fitBounds(bounds, { padding: 60, maxZoom: 12 })
    }

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [activeTab, reports])

  // ── Task Map ─────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'tasks' || !taskMapContainer.current || taskMap.current)
      return
    if (tasks.length === 0) return

    const center = user?.location?.coordinates || [78.9629, 22.5937]
    taskMap.current = new mapboxgl.Map({
      container: taskMapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center,
      zoom: 10,
    })
    taskMap.current.addControl(new mapboxgl.NavigationControl(), 'top-right')

    const bounds = new mapboxgl.LngLatBounds()
    let hasMarkers = false

    tasks.forEach((task) => {
      const lng = task.location?.coordinates?.[0]
      const lat = task.location?.coordinates?.[1]
      if (!lng || !lat) return
      hasMarkers = true

      const statusColor =
        task.status === 'in-progress'
          ? '#3B82F6'
          : task.status === 'completed'
          ? '#10B981'
          : task.status === 'open'
          ? '#F59E0B'
          : '#6B7280'
      const acceptedCount = (task.assignedVolunteers || []).filter(
        (v) => v.status === 'accepted'
      ).length

      const el = document.createElement('div')
      el.style.cssText = `width:40px;height:40px;background:${statusColor};border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:16px;border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.3);cursor:pointer;position:relative;`
      el.textContent = '📋'

      if (acceptedCount > 0) {
        const badge = document.createElement('span')
        badge.style.cssText = `position:absolute;top:-5px;right:-5px;background:#EF4444;color:white;border-radius:50%;width:18px;height:18px;font-size:10px;display:flex;align-items:center;justify-content:center;font-weight:bold;border:2px solid white;`
        badge.textContent = acceptedCount
        el.appendChild(badge)
      }

      new mapboxgl.Marker(el)
        .setLngLat([lng, lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25, maxWidth: '280px' }).setHTML(`
            <div style="padding:10px;">
              <h3 style="font-weight:bold;font-size:14px;margin:0 0 6px;">${task.title}</h3>
              <div style="display:flex;gap:8px;margin-bottom:6px;">
                <span style="background:${statusColor};color:white;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">${task.status?.toUpperCase()}</span>
                <span style="font-size:11px;color:#666;">📂 ${task.category}</span>
              </div>
              <p style="font-size:11px;color:#666;margin:0 0 4px;">👥 ${acceptedCount}/${task.volunteersNeeded} volunteers</p>
              <p style="font-size:11px;color:#666;margin:0 0 4px;">📅 ${task.duration} days • ${new Date(task.startDate).toLocaleDateString()} → ${new Date(task.endDate).toLocaleDateString()}</p>
              ${task.locationName ? `<p style="font-size:10px;color:#999;margin:0;">📍 ${task.locationName}</p>` : ''}
            </div>
          `)
        )
        .addTo(taskMap.current)
      bounds.extend([lng, lat])
    })

    // Add volunteer markers
    approvedVolunteers.forEach((vol) => {
      const lng = vol.location?.coordinates?.[0]
      const lat = vol.location?.coordinates?.[1]
      if (!lng || !lat) return
      hasMarkers = true

      const volColor =
        vol.availabilityStatus === 'FREE'
          ? '#10B981'
          : vol.availabilityStatus === 'BUSY'
          ? '#EF4444'
          : '#F59E0B'

      const el = document.createElement('div')
      el.style.cssText = `width:28px;height:28px;background:${volColor};border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:12px;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.2);`
      el.textContent = '🙋'

      new mapboxgl.Marker(el)
        .setLngLat([lng, lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 15 }).setHTML(`
            <div style="padding:8px;">
              <p style="font-weight:bold;font-size:12px;margin:0 0 4px;">${vol.fullName}</p>
              <p style="font-size:11px;color:${volColor};margin:0 0 2px;font-weight:600;">${vol.availabilityStatus}</p>
              <p style="font-size:10px;color:#999;margin:0;">⭐ ${vol.rating} • ✅ ${vol.tasksCompleted} tasks</p>
            </div>
          `)
        )
        .addTo(taskMap.current)
      bounds.extend([lng, lat])
    })

    if (hasMarkers)
      taskMap.current.fitBounds(bounds, { padding: 60, maxZoom: 13 })

    return () => {
      if (taskMap.current) {
        taskMap.current.remove()
        taskMap.current = null
      }
    }
  }, [activeTab, tasks, approvedVolunteers])

  // ── Handlers ─────────────────────────────────
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
      showSuccess(`Report marked as ${status}`)
    } catch (err) {
      alert('Failed: ' + err.message)
    } finally {
      setReviewLoading(false)
    }
  }

  const handleReviewVolApp = async (appId, action, reason) => {
    setReviewAppLoading(appId)
    try {
      await reportApi.reviewVolunteerApp(appId, {
        action,
        rejectionReason: reason,
      })
      showSuccess(`Volunteer ${action}d`)
      fetchVolunteerApps()
      fetchApprovedVolunteers()
      fetchData()
    } catch (err) {
      alert('Failed: ' + err.message)
    } finally {
      setReviewAppLoading(null)
    }
  }
const handleCreateTask = async (report) => {
  if (!taskForm.title.trim()) return alert('Title required')
  setCreateTaskLoading(true)
  try {
    const loc = report.location?.coordinates
      ? { type: 'Point', coordinates: report.location.coordinates }
      : report.latitude && report.longitude
      ? { type: 'Point', coordinates: [report.longitude, report.latitude] }
      : undefined

    const result = await taskApi.createTask({
      reportId: report._id,
      ngoId: report.ngo?._id || user?.ngo?._id || user?.ngo,
      title: taskForm.title,
      description: taskForm.description,
      category: taskForm.category,
      location: loc,
      locationName: report.locationName,
      volunteersNeeded: taskForm.volunteersNeeded,
      startDate: taskForm.startDate,
      duration: taskForm.duration,
      urgencyScore: report.analysis?.urgencyScore || 50,
      skillsRequired: taskForm.skillsRequired
        ? taskForm.skillsRequired.split(',').map((s) => s.trim())
        : [],
      affectedPeople: taskForm.affectedPeople,
    })

    // ✅ Show notification count
    const notified = result.notifications?.volunteersNotified || 0
    const total = result.notifications?.totalEligible || 0

    if (notified > 0) {
      showSuccess(
        `Task created! 📧 ${notified}/${total} nearby volunteers notified via email`
      )
    } else {
      showSuccess('Task created! No nearby volunteers to notify.')
    }

    setShowCreateTask(null)
    setTaskForm({
      title: '',
      description: '',
      category: 'Community Development',
      volunteersNeeded: 3,
      startDate: new Date().toISOString().split('T')[0],
      duration: 3,
      skillsRequired: '',
      affectedPeople: 0,
    })
    fetchTasks()
  } catch (err) {
    alert('Failed: ' + err.message)
  } finally {
    setCreateTaskLoading(false)
  }
}

  const handleTaskVolReview = async (taskId, volunteerId, action) => {
    setTaskReviewLoading(`${taskId}-${volunteerId}`)
    try {
      await taskApi.reviewTaskVolunteer(taskId, volunteerId, { action })
      showSuccess(
        `Volunteer ${action === 'approve' ? 'approved' : 'rejected'}`
      )
      fetchPendingTaskApps()
      fetchTasks()
      fetchApprovedVolunteers()
    } catch (err) {
      alert('Failed: ' + err.message)
    } finally {
      setTaskReviewLoading(null)
    }
  }

  const handleUpdateDuration = async (taskId) => {
    if (newDuration < 1) return
    try {
      await taskApi.updateDuration(taskId, { duration: newDuration })
      showSuccess('Duration updated')
      setEditDuration(null)
      fetchTasks()
    } catch (err) {
      alert('Failed: ' + err.message)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const filteredReports = reports.filter((r) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      r.title?.toLowerCase().includes(q) ||
      r.analysis?.category?.toLowerCase().includes(q) ||
      r.submittedBy?.fullName?.toLowerCase().includes(q)
    )
  })

  const tabs = [
    { key: 'overview', label: 'Overview', icon: '📊' },
    {
      key: 'reports',
      label: 'Reports',
      icon: '📋',
      badge: stats?.pending,
    },
    {
      key: 'people',
      label: 'People',
      icon: '👥',
      badge: stats?.volunteerAppCount,
    },
    {
      key: 'tasks',
      label: 'Tasks',
      icon: '✅',
      badge: stats?.activeTasks,
    },
    { key: 'map', label: 'Map', icon: '🗺️' },
    { key: 'profile', label: 'Profile', icon: '👤' },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto" />
          <p className="text-gray-500 mt-4">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Navbar ── */}
      <nav className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-2xl shadow">
              👥
            </div>
            <div>
              <h1 className="font-bold text-white text-lg">
                Committee Dashboard
              </h1>
              <p className="text-xs text-purple-100">
                {user?.fullName} •{' '}
                {user?.zone?.name ||
                  user?.assignedZone?.name ||
                  'Zone Member'}
              </p>
            </div>
            <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-white bg-opacity-20 rounded-xl ml-2">
              <span className="text-white text-sm font-medium">
                🏢{' '}
                {user?.ngo?.name ||
                  profile?.ngo?.name ||
                  'NGO'}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-white text-purple-600 rounded-xl text-sm font-medium hover:bg-purple-50"
          >
            Logout
          </button>
        </div>
      </nav>

      {successMsg && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-3 mx-6 mt-4 rounded text-sm animate-pulse">
          ✅ {successMsg}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3 text-sm font-medium flex items-center gap-2 whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
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
        {/* ══════ OVERVIEW ══════ */}
        {activeTab === 'overview' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                Zone Overview
              </h2>
              <p className="text-gray-500 text-sm mt-1">
                Monitor reports, staff, volunteers and tasks
              </p>
            </div>

            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
                {[
                  {
                    label: 'Total Reports',
                    value: stats.total,
                    icon: '📊',
                    bg: 'bg-blue-50',
                    text: 'text-blue-700',
                  },
                  {
                    label: 'Critical',
                    value: stats.critical,
                    icon: '🔴',
                    bg: 'bg-red-50',
                    text: 'text-red-700',
                  },
                  {
                    label: 'Pending Review',
                    value: stats.pending,
                    icon: '⏳',
                    bg: 'bg-yellow-50',
                    text: 'text-yellow-700',
                  },
                  {
                    label: 'Staff Members',
                    value: stats.staffCount,
                    icon: '📋',
                    bg: 'bg-purple-50',
                    text: 'text-purple-700',
                  },
                  {
                    label: 'Volunteers',
                    value: stats.approvedVolunteers,
                    icon: '🙋',
                    bg: 'bg-green-50',
                    text: 'text-green-700',
                  },
                  {
                    label: 'Active Tasks',
                    value: stats.activeTasks,
                    icon: '✅',
                    bg: 'bg-indigo-50',
                    text: 'text-indigo-700',
                  },
                  {
                    label: 'Vol. Applications',
                    value: stats.volunteerAppCount,
                    icon: '📩',
                    bg: 'bg-orange-50',
                    text: 'text-orange-700',
                  },
                  {
                    label: 'Resolved',
                    value: stats.resolved,
                    icon: '✅',
                    bg: 'bg-emerald-50',
                    text: 'text-emerald-700',
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className={`rounded-2xl p-4 shadow-sm border border-gray-100 ${s.bg}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-500">{s.label}</p>
                      <span className="text-xl">{s.icon}</span>
                    </div>
                    <p className={`text-3xl font-bold ${s.text}`}>
                      {s.value || 0}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Quick Actions */}
            <div className="grid md:grid-cols-4 gap-4 mb-6">
              {[
                {
                  label: 'Review Reports',
                  desc: `${stats?.pending || 0} pending`,
                  icon: '📋',
                  tab: 'reports',
                },
                {
                  label: 'Manage People',
                  desc: `${stats?.volunteerAppCount || 0} applications`,
                  icon: '👥',
                  tab: 'people',
                },
                {
                  label: 'View Tasks',
                  desc: `${stats?.activeTasks || 0} active`,
                  icon: '✅',
                  tab: 'tasks',
                },
                {
                  label: 'Map View',
                  desc: 'Geographic overview',
                  icon: '🗺️',
                  tab: 'map',
                },
              ].map((a) => (
                <button
                  key={a.tab}
                  onClick={() => setActiveTab(a.tab)}
                  className="flex items-center gap-3 p-4 bg-white rounded-xl hover:shadow-md transition-shadow border"
                >
                  <span className="text-2xl">{a.icon}</span>
                  <div className="text-left">
                    <p className="font-medium text-gray-800 text-sm">
                      {a.label}
                    </p>
                    <p className="text-xs text-gray-500">{a.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Recent Critical */}
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <div className="px-6 py-4 border-b bg-red-50">
                <h3 className="font-semibold text-red-800 flex items-center gap-2">
                  🔴 Critical Reports Needing Attention
                </h3>
              </div>
              <div className="divide-y max-h-80 overflow-y-auto">
                {reports
                  .filter(
                    (r) =>
                      r.analysis?.severityLevel === 'critical' &&
                      r.status === 'analyzed'
                  )
                  .slice(0, 5)
                  .map((r) => (
                    <div
                      key={r._id}
                      onClick={() => {
                        setSelectedReport(r)
                        setActiveTab('reports')
                      }}
                      className="p-4 hover:bg-gray-50 cursor-pointer"
                    >
                      <p className="font-medium text-gray-800 text-sm">
                        {r.title}
                      </p>
                      <div className="flex gap-3 text-xs text-gray-500 mt-1">
                        <span>⚡ {r.analysis?.urgencyScore}/100</span>
                        <span>
                          👤 {r.submittedBy?.fullName}
                        </span>
                        <span>
                          📅{' '}
                          {new Date(r.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                {reports.filter(
                  (r) =>
                    r.analysis?.severityLevel === 'critical' &&
                    r.status === 'analyzed'
                ).length === 0 && (
                  <div className="p-8 text-center text-gray-400 text-sm">
                    ✅ No critical reports pending
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════ REPORTS ══════ */}
        {(activeTab === 'reports' || activeTab === 'critical') && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">
                  {activeTab === 'critical'
                    ? 'Critical Reports'
                    : 'All Reports'}
                </h2>
                <p className="text-gray-500 text-sm mt-1">
                  Review, create tasks, access PDF files
                </p>
              </div>
              <button
                onClick={fetchReports}
                className="text-sm text-purple-600 hover:underline"
              >
                🔄 Refresh
              </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-5">
              <div className="relative flex-1 min-w-[200px]">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search reports..."
                  className="w-full px-4 py-2 pl-10 border rounded-xl text-sm focus:ring-2 focus:ring-purple-500"
                />
                <span className="absolute left-3 top-2.5 text-gray-400">
                  🔍
                </span>
              </div>
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
                className="px-4 py-2 border rounded-xl text-sm"
              >
                <option value="">All Severity</option>
                <option value="critical">🔴 Critical</option>
                <option value="high">🟠 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border rounded-xl text-sm"
              >
                <option value="">All Status</option>
                <option value="analyzed">⏳ Pending</option>
                <option value="reviewed">👁️ Reviewed</option>
                <option value="resolved">✅ Resolved</option>
                <option value="rejected">❌ Rejected</option>
              </select>
            </div>

            {filteredReports
              .filter((r) =>
                activeTab === 'critical'
                  ? ['critical', 'high'].includes(
                      r.analysis?.severityLevel
                    )
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
                  .filter((r) =>
                    activeTab === 'critical'
                      ? ['critical', 'high'].includes(
                          r.analysis?.severityLevel
                        )
                      : true
                  )
                  .map((report) => {
                    const severity =
                      report.analysis?.severityLevel || 'info'
                    return (
                      <div
                        key={report._id}
                        className={`bg-white rounded-2xl shadow-sm border-l-4 overflow-hidden hover:shadow-md transition ${sev(severity).border}`}
                      >
                        <div className="p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <h4 className="font-semibold text-gray-800 text-lg">
                                  {report.title}
                                </h4>
                                <span
                                  className={`text-xs px-2.5 py-1 rounded-full font-medium ${sev(severity).bg} ${sev(severity).text}`}
                                >
                                  {sev(severity).label}
                                </span>
                                {report.analysis?.immediateRisk && (
                                  <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium animate-pulse">
                                    ⚠️ IMMEDIATE RISK
                                  </span>
                                )}
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                    report.status === 'analyzed'
                                      ? 'bg-purple-100 text-purple-700'
                                      : report.status === 'reviewed'
                                      ? 'bg-blue-100 text-blue-700'
                                      : report.status === 'resolved'
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-gray-100 text-gray-600'
                                  }`}
                                >
                                  {report.status?.toUpperCase()}
                                </span>
                              </div>

                              <div className="flex flex-wrap gap-3 text-xs text-gray-400 mb-3">
                                <span>
                                  👤 {report.submittedBy?.fullName}
                                </span>
                                <span>
                                  📅{' '}
                                  {new Date(
                                    report.createdAt
                                  ).toLocaleString()}
                                </span>
                                {report.locationName && (
                                  <span>📍 {report.locationName}</span>
                                )}
                              </div>

                              {/* Urgency */}
                              <div className="flex items-center gap-3 mb-3">
                                <span className="text-xs text-gray-500 w-20">
                                  Urgency
                                </span>
                                <div className="flex-1 bg-gray-100 rounded-full h-3">
                                  <div
                                    className={`h-3 rounded-full ${sev(severity).bar}`}
                                    style={{
                                      width: `${report.analysis?.urgencyScore || 0}%`,
                                    }}
                                  />
                                </div>
                                <span className="text-sm font-bold text-gray-700 w-12 text-right">
                                  {report.analysis?.urgencyScore || 0}
                                  /100
                                </span>
                              </div>

                              {report.analysis?.summary && (
                                <div
                                  className={`rounded-xl p-3 mb-3 ${sev(severity).bg}`}
                                >
                                  <p className="text-xs font-medium text-gray-600 mb-1">
                                    🤖 AI Summary
                                  </p>
                                  <p className="text-sm text-gray-800 leading-relaxed">
                                    {report.analysis.summary}
                                  </p>
                                </div>
                              )}

                              <div className="flex flex-wrap gap-1.5">
                                {report.analysis?.category && (
                                  <span className="bg-blue-100 text-blue-700 text-xs px-2.5 py-1 rounded-full font-medium">
                                    📂 {report.analysis.category}
                                  </span>
                                )}
                                {report.analysis?.keywords
                                  ?.slice(0, 4)
                                  .map((kw) => (
                                    <span
                                      key={kw}
                                      className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full"
                                    >
                                      {kw}
                                    </span>
                                  ))}
                                {report.analysis?.affectedPeople && (
                                  <span className="bg-red-100 text-red-600 text-xs px-2.5 py-1 rounded-full">
                                    👥 ~{report.analysis.affectedPeople}{' '}
                                    people
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Right panel */}
                            <div className="flex flex-col gap-2 flex-shrink-0 w-40">
                              {report.fileUrl &&
                                report.fileType === 'image' && (
                                  <div className="border rounded-xl overflow-hidden">
                                    <img
                                      src={`${BASE_URL}${report.fileUrl}`}
                                      alt="proof"
                                      className="w-full h-24 object-cover"
                                    />
                                    <p className="text-xs text-center text-gray-500 py-1">
                                      📷 Photo
                                    </p>
                                  </div>
                                )}
                              {report.fileUrl &&
                                report.fileType === 'pdf' && (
                                  <a
                                    href={`${BASE_URL}${report.fileUrl}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg p-2 hover:bg-blue-100 font-medium"
                                  >
                                    📄 View PDF Document
                                  </a>
                                )}
                              {report.status === 'analyzed' && (
                                <>
                                  <button
                                    onClick={() =>
                                      setSelectedReport(report)
                                    }
                                    className="px-3 py-2 bg-purple-600 text-white text-xs rounded-lg font-medium hover:bg-purple-700"
                                  >
                                    👁️ Review
                                  </button>
                                  <button
                                    onClick={() => {
                                      setShowCreateTask(report)
                                      setTaskForm((f) => ({
                                        ...f,
                                        title: `Task: ${report.title}`,
                                        description:
                                          report.analysis?.summary || '',
                                        affectedPeople:
                                          report.analysis
                                            ?.affectedPeople || 0,
                                      }))
                                    }}
                                    className="px-3 py-2 bg-green-600 text-white text-xs rounded-lg font-medium hover:bg-green-700"
                                  >
                                    ✅ Create Task
                                  </button>
                                </>
                              )}
                              {report.status !== 'analyzed' && (
                                <button
                                  onClick={() =>
                                    setSelectedReport(report)
                                  }
                                  className="px-3 py-2 bg-gray-100 text-gray-600 text-xs rounded-lg font-medium"
                                >
                                  View Details
                                </button>
                              )}
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

        {/* ══════ PEOPLE ══════ */}
        {activeTab === 'people' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">
              People Management
            </h2>

            {/* Staff */}
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <div className="px-6 py-4 border-b bg-purple-50 flex items-center justify-between">
                <h3 className="font-semibold text-purple-800">
                  📋 Zone Staff ({staff.length})
                </h3>
                <button
                  onClick={fetchStaff}
                  className="text-xs text-purple-600 hover:underline"
                >
                  🔄
                </button>
              </div>
              {staffLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin h-8 w-8 border-2 border-purple-600 border-t-transparent rounded-full mx-auto" />
                </div>
              ) : staff.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  No staff in this zone
                </div>
              ) : (
                <div className="divide-y">
                  {staff.map((s) => (
                    <div
                      key={s._id}
                      className="p-4 flex items-center justify-between hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-lg">
                          📋
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 text-sm">
                            {s.fullName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {s.email}
                          </p>
                          {s.locationName && (
                            <p className="text-xs text-gray-400">
                              📍 {s.locationName}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                          📊 {s.reportCount} reports
                        </span>
                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full">
                          📤 {s.sentCount} sent
                        </span>
                        <span
                          className={`px-2 py-1 rounded-full font-medium ${
                            s.status === 'active'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {s.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Volunteer Applications */}
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <div className="px-6 py-4 border-b bg-orange-50 flex items-center justify-between">
                <h3 className="font-semibold text-orange-800">
                  📩 Volunteer Applications (
                  {volunteerApps.length})
                </h3>
                <select
                  value={volAppFilter}
                  onChange={(e) => setVolAppFilter(e.target.value)}
                  className="text-xs border rounded-lg px-2 py-1"
                >
                  <option value="">All</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              {volAppsLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin h-8 w-8 border-2 border-orange-600 border-t-transparent rounded-full mx-auto" />
                </div>
              ) : volunteerApps.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  No applications
                </div>
              ) : (
                <div className="divide-y max-h-[500px] overflow-y-auto">
                  {volunteerApps.map((app) => (
                    <div
                      key={app._id}
                      className="p-4 hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                              app.status === 'approved'
                                ? 'bg-green-100'
                                : app.status === 'pending'
                                ? 'bg-yellow-100'
                                : 'bg-red-100'
                            }`}
                          >
                            {app.status === 'approved'
                              ? '✅'
                              : app.status === 'pending'
                              ? '⏳'
                              : '❌'}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800 text-sm">
                              {app.volunteerId?.fullName ||
                                'Unknown'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {app.volunteerId?.email}
                            </p>
                            {app.volunteerId?.locationName && (
                              <p className="text-xs text-gray-400">
                                📍{' '}
                                {app.volunteerId.locationName}
                              </p>
                            )}
                            {app.volunteerId?.volunteerProfile
                              ?.skills?.length > 0 && (
                              <div className="flex gap-1 mt-1 flex-wrap">
                                {app.volunteerId.volunteerProfile.skills
                                  .slice(0, 3)
                                  .map((sk) => (
                                    <span
                                      key={sk}
                                      className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded"
                                    >
                                      {sk}
                                    </span>
                                  ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {app.status === 'pending' ? (
                            <>
                              <button
                                onClick={() =>
                                  handleReviewVolApp(
                                    app._id,
                                    'approve'
                                  )
                                }
                                disabled={
                                  reviewAppLoading === app._id
                                }
                                className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg font-medium disabled:opacity-50"
                              >
                                ✅ Approve
                              </button>
                              <button
                                onClick={() =>
                                  handleReviewVolApp(
                                    app._id,
                                    'reject'
                                  )
                                }
                                disabled={
                                  reviewAppLoading === app._id
                                }
                                className="px-3 py-1.5 bg-red-100 text-red-700 text-xs rounded-lg font-medium disabled:opacity-50"
                              >
                                ❌ Reject
                              </button>
                            </>
                          ) : (
                            <span
                              className={`text-xs px-3 py-1.5 rounded-full font-bold ${
                                app.status === 'approved'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {app.status === 'approved'
                                ? '✅ Approved'
                                : '❌ Rejected'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Approved Volunteers */}
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <div className="px-6 py-4 border-b bg-green-50">
                <h3 className="font-semibold text-green-800">
                  🙋 Approved Volunteers (
                  {approvedVolunteers.length})
                </h3>
              </div>
              {approvedVolLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin h-8 w-8 border-2 border-green-600 border-t-transparent rounded-full mx-auto" />
                </div>
              ) : approvedVolunteers.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  No approved volunteers yet
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                  {approvedVolunteers.map((vol) => (
                    <div
                      key={vol._id}
                      className="border rounded-xl p-4 hover:shadow-md transition"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                            vol.availabilityStatus === 'FREE'
                              ? 'bg-green-100'
                              : vol.availabilityStatus === 'BUSY'
                              ? 'bg-red-100'
                              : 'bg-yellow-100'
                          }`}
                        >
                          🙋
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-800 text-sm">
                            {vol.fullName}
                          </p>
                          <p
                            className={`text-xs font-bold ${
                              vol.availabilityStatus === 'FREE'
                                ? 'text-green-600'
                                : vol.availabilityStatus === 'BUSY'
                                ? 'text-red-600'
                                : 'text-yellow-600'
                            }`}
                          >
                            {vol.availabilityStatus}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 text-xs text-gray-500 mb-2">
                        <span>⭐ {vol.rating || 0}</span>
                        <span>
                          ✅ {vol.tasksCompleted || 0} tasks
                        </span>
                      </div>
                      {vol.skills?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {vol.skills.slice(0, 4).map((sk) => (
                            <span
                              key={sk}
                              className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded"
                            >
                              {sk}
                            </span>
                          ))}
                        </div>
                      )}
                      {vol.locationName && (
                        <p className="text-xs text-gray-400 mt-2">
                          📍 {vol.locationName}
                        </p>
                      )}
                      {vol.busyUntil && vol.availabilityStatus === 'BUSY' && (
                        <p className="text-xs text-red-500 mt-1">
                          Busy until{' '}
                          {new Date(vol.busyUntil).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════ TASKS ══════ */}
        {activeTab === 'tasks' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">
                  Task Management
                </h2>
                <p className="text-gray-500 text-sm mt-1">
                  Create, assign, and track tasks on map
                </p>
              </div>
              <div className="flex gap-2">
                <select
                  value={taskFilter}
                  onChange={(e) => setTaskFilter(e.target.value)}
                  className="text-sm border rounded-xl px-3 py-2"
                >
                  <option value="">All Tasks</option>
                  <option value="open">🟡 Open</option>
                  <option value="in-progress">🔵 In Progress</option>
                  <option value="completed">🟢 Completed</option>
                </select>
                <button
                  onClick={() => {
                    fetchTasks()
                    fetchPendingTaskApps()
                  }}
                  className="text-sm text-purple-600 px-3 py-2 border rounded-xl hover:bg-purple-50"
                >
                  🔄
                </button>
              </div>
            </div>

            {/* Task Map */}
            {tasks.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                <div className="px-6 py-4 border-b flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800">
                    🗺️ Tasks & Volunteers Map
                  </h3>
                  <div className="flex gap-3 text-xs">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" />{' '}
                      Open
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />{' '}
                      In Progress
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />{' '}
                      Completed
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-green-400 inline-block" />{' '}
                      🙋 Volunteer
                    </span>
                  </div>
                </div>
                <div ref={taskMapContainer} className="w-full h-96" />
              </div>
            )}

            {/* Pending Volunteer Applications for Tasks */}
            {pendingTaskApps.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                <div className="px-6 py-4 border-b bg-yellow-50">
                  <h3 className="font-semibold text-yellow-800">
                    ⏳ Pending Volunteer Task Applications (
                    {pendingTaskApps.length})
                  </h3>
                </div>
                <div className="divide-y max-h-80 overflow-y-auto">
                  {pendingTaskApps.map((app, i) => (
                    <div
                      key={i}
                      className="p-4 flex items-center justify-between hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center text-lg">
                          🙋
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 text-sm">
                            {app.volunteer?.fullName || 'Volunteer'}
                          </p>
                          <p className="text-xs text-gray-500">
                            → {app.taskTitle}
                          </p>
                          <p className="text-xs text-gray-400">
                            📂 {app.taskCategory} •{' '}
                            {app.volunteersAccepted}/
                            {app.volunteersNeeded} filled
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            handleTaskVolReview(
                              app.taskId,
                              app.volunteer?._id,
                              'approve'
                            )
                          }
                          disabled={
                            taskReviewLoading ===
                            `${app.taskId}-${app.volunteer?._id}`
                          }
                          className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg font-medium disabled:opacity-50"
                        >
                          ✅ Approve
                        </button>
                        <button
                          onClick={() =>
                            handleTaskVolReview(
                              app.taskId,
                              app.volunteer?._id,
                              'reject'
                            )
                          }
                          disabled={
                            taskReviewLoading ===
                            `${app.taskId}-${app.volunteer?._id}`
                          }
                          className="px-3 py-1.5 bg-red-100 text-red-700 text-xs rounded-lg font-medium disabled:opacity-50"
                        >
                          ❌ Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Task List */}
            {tasksLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin h-8 w-8 border-2 border-purple-600 border-t-transparent rounded-full mx-auto" />
              </div>
            ) : tasks.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
                <p className="text-5xl mb-3">✅</p>
                <p className="text-gray-500">No tasks yet</p>
                <p className="text-gray-400 text-sm mt-1">
                  Create tasks from reports to assign volunteers
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {tasks.map((task) => {
                  const accepted = (task.assignedVolunteers || []).filter(
                    (v) => v.status === 'accepted'
                  )
                  const pending = (task.assignedVolunteers || []).filter(
                    (v) => v.status === 'pending_approval'
                  )
                  const statusColor =
                    task.status === 'in-progress'
                      ? 'border-blue-500'
                      : task.status === 'completed'
                      ? 'border-green-500'
                      : task.status === 'open'
                      ? 'border-yellow-500'
                      : 'border-gray-300'

                  return (
                    <div
                      key={task._id}
                      className={`bg-white rounded-2xl shadow-sm border-l-4 ${statusColor} overflow-hidden hover:shadow-md transition`}
                    >
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <h4 className="font-semibold text-gray-800 text-lg">
                                {task.title}
                              </h4>
                              <span
                                className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                                  task.status === 'open'
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : task.status === 'in-progress'
                                    ? 'bg-blue-100 text-blue-700'
                                    : task.status === 'completed'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {task.status?.toUpperCase()}
                              </span>
                              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                                📂 {task.category}
                              </span>
                            </div>

                            {task.description && (
                              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                                {task.description}
                              </p>
                            )}

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-xs">
                              <div className="bg-gray-50 rounded-lg p-2">
                                <p className="text-gray-400">📅 Duration</p>
                                <div className="flex items-center gap-1">
                                  <p className="font-bold text-gray-800">
                                    {task.duration} days
                                  </p>
                                  {editDuration === task._id ? (
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        min="1"
                                        value={newDuration}
                                        onChange={(e) =>
                                          setNewDuration(
                                            parseInt(e.target.value)
                                          )
                                        }
                                        className="w-12 border rounded px-1 py-0.5 text-xs"
                                      />
                                      <button
                                        onClick={() =>
                                          handleUpdateDuration(task._id)
                                        }
                                        className="text-green-600"
                                      >
                                        ✓
                                      </button>
                                      <button
                                        onClick={() =>
                                          setEditDuration(null)
                                        }
                                        className="text-red-600"
                                      >
                                        ✗
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setEditDuration(task._id)
                                        setNewDuration(task.duration)
                                      }}
                                      className="text-blue-500 hover:underline"
                                    >
                                      ✏️
                                    </button>
                                  )}
                                </div>
                                <p className="text-gray-400 mt-0.5">
                                  {new Date(
                                    task.startDate
                                  ).toLocaleDateString()}{' '}
                                  →{' '}
                                  {new Date(
                                    task.endDate
                                  ).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="bg-gray-50 rounded-lg p-2">
                                <p className="text-gray-400">
                                  👥 Volunteers
                                </p>
                                <p className="font-bold text-gray-800">
                                  {accepted.length}/
                                  {task.volunteersNeeded}
                                </p>
                                {pending.length > 0 && (
                                  <p className="text-yellow-600">
                                    +{pending.length} pending
                                  </p>
                                )}
                              </div>
                              <div className="bg-gray-50 rounded-lg p-2">
                                <p className="text-gray-400">⚡ Urgency</p>
                                <p className="font-bold text-gray-800">
                                  {task.urgencyScore}/100
                                </p>
                              </div>
                              <div className="bg-gray-50 rounded-lg p-2">
                                <p className="text-gray-400">📍 Location</p>
                                <p className="font-bold text-gray-800 truncate">
                                  {task.locationName || 'N/A'}
                                </p>
                              </div>
                            </div>

                            {/* Assigned Volunteers */}
                            {accepted.length > 0 && (
                              <div className="mb-2">
                                <p className="text-xs font-medium text-gray-500 mb-1">
                                  Assigned Volunteers:
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {accepted.map((v) => (
                                    <span
                                      key={v.volunteerId?._id || v._id}
                                      className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full"
                                    >
                                      ✅{' '}
                                      {v.volunteerId?.fullName ||
                                        'Volunteer'}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {task.skillsRequired?.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {task.skillsRequired.map((sk) => (
                                  <span
                                    key={sk}
                                    className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full"
                                  >
                                    🛠️ {sk}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Report PDF */}
                          <div className="flex flex-col gap-2 flex-shrink-0 w-36">
                            {task.reportId?.fileUrl &&
                              task.reportId?.fileType === 'pdf' && (
                                <a
                                  href={`${BASE_URL}${task.reportId.fileUrl}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg p-2 hover:bg-blue-100 font-medium"
                                >
                                  📄 Report PDF
                                </a>
                              )}
                            {task.reportId?.fileUrl &&
                              task.reportId?.fileType === 'image' && (
                                <a
                                  href={`${BASE_URL}${task.reportId.fileUrl}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg p-2 hover:bg-blue-100 font-medium"
                                >
                                  📷 Report Image
                                </a>
                              )}
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

        {/* ══════ MAP ══════ */}
        {activeTab === 'map' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                Geographic View
              </h2>
              <p className="text-gray-500 text-sm mt-1">
                Reports plotted by location • Click markers for details
              </p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <div ref={mapContainer} className="w-full h-[600px]" />
            </div>
          </div>
        )}

        {/* ══════ PROFILE ══════ */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            {profileLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin h-8 w-8 border-2 border-purple-600 border-t-transparent rounded-full mx-auto" />
              </div>
            ) : !profile ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
                <p className="text-5xl mb-3">👤</p>
                <p className="text-gray-500">Could not load profile</p>
              </div>
            ) : (
              <>
                {/* Header Card */}
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-6 text-white">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-3xl shadow">
                      👥
                    </div>
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold">
                        {profile.user?.fullName}
                      </h2>
                      <p className="text-purple-100 text-sm">
                        {profile.user?.email}
                      </p>
                      <p className="text-purple-200 text-xs mt-1">
                        📍{' '}
                        {profile.user?.locationName || 'Location not set'}
                      </p>
                    </div>
                    <span className="bg-white bg-opacity-20 text-white text-xs px-3 py-1 rounded-full font-medium">
                      Committee Member
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    {
                      val: profile.stats?.totalReports || 0,
                      label: 'Total Reports',
                      color: 'text-blue-600',
                    },
                    {
                      val: profile.stats?.criticalReports || 0,
                      label: 'Critical',
                      color: 'text-red-600',
                    },
                    {
                      val: profile.stats?.resolvedReports || 0,
                      label: 'Resolved',
                      color: 'text-green-600',
                    },
                    {
                      val: profile.stats?.activeTasks || 0,
                      label: 'Active Tasks',
                      color: 'text-indigo-600',
                    },
                    {
                      val: profile.stats?.completedTasks || 0,
                      label: 'Done Tasks',
                      color: 'text-emerald-600',
                    },
                    {
                      val: profile.stats?.staffCount || 0,
                      label: 'Staff',
                      color: 'text-purple-600',
                    },
                    {
                      val: profile.stats?.approvedVolunteers || 0,
                      label: 'Volunteers',
                      color: 'text-orange-600',
                    },
                  ].map((s, i) => (
                    <div
                      key={i}
                      className="bg-white rounded-xl p-4 shadow-sm text-center border"
                    >
                      <p className={`text-2xl font-bold ${s.color}`}>
                        {s.val}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {s.label}
                      </p>
                    </div>
                  ))}
                </div>

                {/* NGO Card */}
                {profile.ngo && (
                  <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                    <div className="px-6 py-4 border-b bg-blue-50">
                      <h3 className="font-semibold text-blue-800 flex items-center gap-2">
                        🏢 My NGO
                      </h3>
                    </div>
                    <div className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center text-2xl">
                          🏢
                        </div>
                        <div className="flex-1">
                          <h4 className="text-lg font-bold text-gray-800">
                            {profile.ngo.name}
                          </h4>
                          {profile.ngo.description && (
                            <p className="text-sm text-gray-600 mt-1">
                              {profile.ngo.description}
                            </p>
                          )}
                          <div className="grid sm:grid-cols-2 gap-3 mt-4 text-sm">
                            {profile.ngo.contactEmail && (
                              <p>
                                <strong>Email:</strong>{' '}
                                {profile.ngo.contactEmail}
                              </p>
                            )}
                            {profile.ngo.website && (
                              <p>
                                <strong>Website:</strong>{' '}
                                <a
                                  href={profile.ngo.website}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-600 hover:underline"
                                >
                                  {profile.ngo.website}
                                </a>
                              </p>
                            )}
                            {profile.ngo.locationName && (
                              <p>
                                <strong>Location:</strong>{' '}
                                {profile.ngo.locationName}
                              </p>
                            )}
                            <p>
                              <strong>Status:</strong>{' '}
                              <span
                                className={`font-bold ${
                                  profile.ngo.status === 'approved'
                                    ? 'text-green-600'
                                    : 'text-yellow-600'
                                }`}
                              >
                                {profile.ngo.status?.toUpperCase()}
                              </span>
                            </p>
                          </div>
                          {profile.ngoManager && (
                            <div className="mt-4 bg-gray-50 rounded-xl p-3">
                              <p className="text-xs font-medium text-gray-500 mb-1">
                                NGO Manager
                              </p>
                              <p className="text-sm font-semibold text-gray-800">
                                {profile.ngoManager.fullName}
                              </p>
                              <p className="text-xs text-gray-500">
                                {profile.ngoManager.email}
                                {profile.ngoManager.phone &&
                                  ` • ${profile.ngoManager.phone}`}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Zone Card */}
                {profile.zone && (
                  <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                    <div className="px-6 py-4 border-b bg-purple-50">
                      <h3 className="font-semibold text-purple-800 flex items-center gap-2">
                        📍 My Zone
                      </h3>
                    </div>
                    <div className="p-6">
                      <h4 className="text-lg font-bold text-gray-800 mb-2">
                        {profile.zone.name}
                      </h4>
                      {profile.zone.description && (
                        <p className="text-sm text-gray-600 mb-3">
                          {profile.zone.description}
                        </p>
                      )}
                      <div className="grid sm:grid-cols-2 gap-3 text-sm">
                        {profile.zone.city && (
                          <p>
                            <strong>City:</strong> {profile.zone.city}
                          </p>
                        )}
                        {profile.zone.state && (
                          <p>
                            <strong>State:</strong> {profile.zone.state}
                          </p>
                        )}
                        {profile.zone.country && (
                          <p>
                            <strong>Country:</strong>{' '}
                            {profile.zone.country}
                          </p>
                        )}
                        {profile.zone.pincode && (
                          <p>
                            <strong>Pincode:</strong>{' '}
                            {profile.zone.pincode}
                          </p>
                        )}
                        {profile.zone.locationName && (
                          <p>
                            <strong>Location:</strong>{' '}
                            {profile.zone.locationName}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Personal Details */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="bg-white rounded-2xl p-5 shadow-sm border">
                    <h4 className="text-sm font-medium text-gray-600 mb-3">
                      Contact Info
                    </h4>
                    <div className="space-y-2 text-sm">
                      <p>
                        <strong>Email:</strong> {profile.user?.email}
                      </p>
                      <p>
                        <strong>Phone:</strong>{' '}
                        {profile.user?.phone || 'Not set'}
                      </p>
                      <p>
                        <strong>Status:</strong>{' '}
                        <span className="text-green-600 font-medium">
                          {profile.user?.status}
                        </span>
                      </p>
                      <p>
                        <strong>Joined:</strong>{' '}
                        {new Date(
                          profile.user?.createdAt
                        ).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl p-5 shadow-sm border">
                    <h4 className="text-sm font-medium text-gray-600 mb-3">
                      Appointment
                    </h4>
                    <div className="space-y-2 text-sm">
                      {profile.user?.committeeProfile?.appointedBy && (
                        <p>
                          <strong>Appointed By:</strong>{' '}
                          {profile.user.committeeProfile.appointedBy
                            ?.fullName || 'N/A'}
                        </p>
                      )}
                      {profile.user?.committeeProfile?.appointedAt && (
                        <p>
                          <strong>Appointed On:</strong>{' '}
                          {new Date(
                            profile.user.committeeProfile.appointedAt
                          ).toLocaleDateString()}
                        </p>
                      )}
                      <p>
                        <strong>Role:</strong>{' '}
                        <span className="text-purple-600 font-medium">
                          Zone Committee Member
                        </span>
                      </p>
                      <div className="bg-purple-50 rounded-lg p-3 mt-2">
                        <p className="text-xs text-purple-700">
                          💡 As the sole committee member for this zone,
                          you manage all staff, volunteers, reports, and
                          tasks.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ══ REVIEW REPORT MODAL ══ */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between z-10">
              <h3 className="text-lg font-bold text-gray-800">
                Report Review
              </h3>
              <button
                onClick={() => {
                  setSelectedReport(null)
                  setReviewNotes('')
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <h4 className="text-xl font-bold text-gray-800 mb-1">
                  {selectedReport.title}
                </h4>
                <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                  <span>
                    👤 {selectedReport.submittedBy?.fullName}
                  </span>
                  <span>
                    📅{' '}
                    {new Date(
                      selectedReport.createdAt
                    ).toLocaleString()}
                  </span>
                  {selectedReport.locationName && (
                    <span>📍 {selectedReport.locationName}</span>
                  )}
                </div>
              </div>

              {/* Severity & Urgency */}
              <div className="grid grid-cols-3 gap-3">
                <div
                  className={`rounded-xl p-3 text-center ${sev(selectedReport.analysis?.severityLevel).bg}`}
                >
                  <p className="text-xs text-gray-500">Severity</p>
                  <p
                    className={`font-bold ${sev(selectedReport.analysis?.severityLevel).text}`}
                  >
                    {
                      sev(selectedReport.analysis?.severityLevel)
                        .label
                    }
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500">Urgency</p>
                  <p className="text-2xl font-bold text-gray-800">
                    {selectedReport.analysis?.urgencyScore || 0}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500">Category</p>
                  <p className="text-sm font-bold text-gray-800 mt-1">
                    {selectedReport.analysis?.category || 'N/A'}
                  </p>
                </div>
              </div>

              {selectedReport.analysis?.summary && (
                <div
                  className={`rounded-xl p-4 ${sev(selectedReport.analysis?.severityLevel).bg}`}
                >
                  <p className="text-xs font-semibold text-gray-600 mb-1">
                    🤖 AI Summary
                  </p>
                  <p className="text-sm text-gray-800 leading-relaxed">
                    {selectedReport.analysis.summary}
                  </p>
                </div>
              )}

              {selectedReport.analysis?.keyProblems?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-2">
                    🔍 Key Problems
                  </p>
                  <ul className="space-y-1">
                    {selectedReport.analysis.keyProblems.map(
                      (p, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm text-gray-700"
                        >
                          <span className="text-red-500">•</span>
                          {p}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}

              {selectedReport.analysis?.suggestedActions?.length >
                0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-2">
                    ✅ Suggested Actions
                  </p>
                  <ul className="space-y-1">
                    {selectedReport.analysis.suggestedActions.map(
                      (a, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm text-gray-700"
                        >
                          <span className="text-green-500">→</span>
                          {a}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}

              {/* File Access */}
              {selectedReport.fileUrl && (
                <div className="border rounded-xl p-3">
                  {selectedReport.fileType === 'image' ? (
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-2">
                        📷 Attached Photo
                      </p>
                      <img
                        src={`${BASE_URL}${selectedReport.fileUrl}`}
                        alt="report"
                        className="w-full h-48 object-cover rounded-lg"
                      />
                    </div>
                  ) : selectedReport.fileType === 'pdf' ? (
                    <a
                      href={`${BASE_URL}${selectedReport.fileUrl}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-blue-600 hover:underline font-medium"
                    >
                      📄 Open PDF Document →
                    </a>
                  ) : null}
                </div>
              )}

              {/* Review Actions */}
              {selectedReport.status === 'analyzed' && (
                <div className="border-t pt-4 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Review Notes
                    </label>
                    <textarea
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Add notes about this report..."
                      rows={3}
                      className="w-full px-4 py-2.5 border rounded-xl text-sm resize-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => handleReview('reviewed')}
                      disabled={reviewLoading}
                      className="py-2.5 bg-blue-600 text-white text-sm rounded-xl font-medium disabled:opacity-50"
                    >
                      👁️ Mark Reviewed
                    </button>
                    <button
                      onClick={() => handleReview('resolved')}
                      disabled={reviewLoading}
                      className="py-2.5 bg-green-600 text-white text-sm rounded-xl font-medium disabled:opacity-50"
                    >
                      ✅ Resolve
                    </button>
                    <button
                      onClick={() => handleReview('rejected')}
                      disabled={reviewLoading}
                      className="py-2.5 bg-red-100 text-red-700 text-sm rounded-xl font-medium disabled:opacity-50"
                    >
                      ❌ Reject
                    </button>
                  </div>
                </div>
              )}

              {selectedReport.status !== 'analyzed' && (
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className="text-sm text-gray-600">
                    Status:{' '}
                    <span className="font-bold">
                      {selectedReport.status?.toUpperCase()}
                    </span>
                  </p>
                  {selectedReport.reviewNotes && (
                    <p className="text-xs text-gray-500 mt-1 italic">
                      Notes: "{selectedReport.reviewNotes}"
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ CREATE TASK MODAL ══ */}
      {showCreateTask && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between z-10">
              <div>
                <h3 className="text-lg font-bold text-gray-800">
                  ✅ Create Task
                </h3>
                <p className="text-xs text-gray-500">
                  From: {showCreateTask.title}
                </p>
              </div>
              <button
                onClick={() => setShowCreateTask(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  value={taskForm.title}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, title: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={taskForm.description}
                  onChange={(e) =>
                    setTaskForm({
                      ...taskForm,
                      description: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full px-4 py-2.5 border rounded-xl text-sm resize-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={taskForm.category}
                    onChange={(e) =>
                      setTaskForm({
                        ...taskForm,
                        category: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 border rounded-xl text-sm"
                  >
                    {TASK_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Volunteers Needed *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={taskForm.volunteersNeeded}
                    onChange={(e) =>
                      setTaskForm({
                        ...taskForm,
                        volunteersNeeded: parseInt(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2.5 border rounded-xl text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={taskForm.startDate}
                    onChange={(e) =>
                      setTaskForm({
                        ...taskForm,
                        startDate: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 border rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duration (days) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={taskForm.duration}
                    onChange={(e) =>
                      setTaskForm({
                        ...taskForm,
                        duration: parseInt(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2.5 border rounded-xl text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Skills Required (comma separated)
                </label>
                <input
                  type="text"
                  value={taskForm.skillsRequired}
                  onChange={(e) =>
                    setTaskForm({
                      ...taskForm,
                      skillsRequired: e.target.value,
                    })
                  }
                  placeholder="e.g. First Aid, Cooking, Teaching"
                  className="w-full px-4 py-2.5 border rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Affected People
                </label>
                <input
                  type="number"
                  min="0"
                  value={taskForm.affectedPeople}
                  onChange={(e) =>
                    setTaskForm({
                      ...taskForm,
                      affectedPeople: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-4 py-2.5 border rounded-xl text-sm"
                />
              </div>

              {/* Report info */}
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">
                  📋 Source Report
                </p>
                <p className="text-sm font-medium text-gray-800">
                  {showCreateTask.title}
                </p>
                <p className="text-xs text-gray-500">
                  {showCreateTask.locationName || 'No location'} •
                  Urgency:{' '}
                  {showCreateTask.analysis?.urgencyScore || 0}/100
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCreateTask(null)}
                  className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl text-gray-600 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleCreateTask(showCreateTask)}
                  disabled={createTaskLoading}
                  className="flex-1 py-2.5 bg-green-600 text-white rounded-xl font-medium disabled:opacity-50"
                >
                  {createTaskLoading
                    ? '⏳ Creating...'
                    : '✅ Create Task'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}