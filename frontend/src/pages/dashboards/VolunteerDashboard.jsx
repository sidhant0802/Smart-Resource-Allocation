// import { useAuth } from '../../context/AuthContext'
// import { useNavigate } from 'react-router-dom'

// export default function VolunteerDashboard() {
//   const { user, logout } = useAuth()
//   const navigate = useNavigate()

//   return (
//     <div className="min-h-screen bg-gray-50">
//       <nav className="bg-white border-b border-gray-200 px-6 py-4
//                       flex items-center justify-between shadow-sm">
//         <div className="flex items-center gap-3">
//           <span className="text-3xl">🙋</span>
//           <div>
//             <h1 className="font-bold text-gray-800">Volunteer</h1>
//             <p className="text-xs text-gray-500">
//               📍 {user?.locationName || 'Location not set'}
//             </p>
//           </div>
//         </div>
//         <div className="flex items-center gap-4">
//           <span className="text-sm text-gray-600">
//             Hi, {user?.fullName}
//           </span>
//           <button
//             onClick={() => { logout(); navigate('/login') }}
//             className="text-sm bg-red-50 text-red-600 px-4 py-2
//                        rounded-lg hover:bg-red-100 font-medium"
//           >
//             Logout
//           </button>
//         </div>
//       </nav>

//       <div className="max-w-7xl mx-auto p-6">
//         <div className="grid grid-cols-3 gap-4 mb-6">
//           {[
//             {
//               label: 'Tasks Done',
//               value: user?.volunteerProfile?.tasksCompleted || 0,
//               icon:  '✅',
//             },
//             {
//               label: 'People Helped',
//               value: user?.volunteerProfile?.peopleHelped || 0,
//               icon:  '❤️',
//             },
//             {
//               label: 'My Rating',
//               value: user?.volunteerProfile?.rating || '—',
//               icon:  '⭐',
//             },
//           ].map(card => (
//             <div key={card.label}
//                  className="bg-white rounded-2xl p-4 shadow-sm
//                             border border-gray-100 text-center">
//               <p className="text-2xl">{card.icon}</p>
//               <p className="text-2xl font-bold text-gray-800 mt-1">
//                 {card.value}
//               </p>
//               <p className="text-xs text-gray-500">{card.label}</p>
//             </div>
//           ))}
//         </div>

//         {user?.volunteerProfile?.skills?.length > 0 && (
//           <div className="bg-white rounded-2xl p-5 shadow-sm
//                           border border-gray-100 mb-4">
//             <h3 className="font-semibold text-gray-800 mb-3">
//               My Skills
//             </h3>
//             <div className="flex flex-wrap gap-2">
//               {user.volunteerProfile.skills.map(s => (
//                 <span key={s}
//                       className="bg-blue-100 text-blue-700 text-xs
//                                  px-3 py-1 rounded-full font-medium">
//                   {s}
//                 </span>
//               ))}
//             </div>
//           </div>
//         )}

//         <div className="bg-white rounded-2xl p-6 shadow-sm
//                         border border-gray-100 text-center">
//           <p className="text-4xl mb-2">🗺️</p>
//           <p className="text-gray-500 text-sm">
//             Nearby tasks will appear here once approved
//           </p>
//         </div>
//       </div>
//     </div>
//   )
// }










import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

export default function VolunteerDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState('overview')
  const [tasks, setTasks] = useState([])
  const [myTasks, setMyTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)

  // Map
  const mapContainer = useRef(null)
  const map = useRef(null)

  useEffect(() => {
    fetchVolunteerData()
  }, [])

  // Initialize map when switching to map tab
  useEffect(() => {
    if (activeTab === 'map' && !map.current && mapContainer.current) {
      initMap()
    }
  }, [activeTab, tasks])

  const fetchVolunteerData = async () => {
    setLoading(true)
    try {
      // TODO: Replace with actual API call
      const mockData = {
        availableTasks: [
          {
            _id: '1',
            title: 'Food Distribution Drive',
            description: 'Help distribute meals to 50 families in the area',
            category: 'Food Security',
            urgencyScore: 85,
            skillsRequired: ['Communication', 'Physical Work'],
            location: { type: 'Point', coordinates: [77.2090, 28.6139] },
            locationName: 'Connaught Place, New Delhi',
            volunteersNeeded: 5,
            volunteersAssigned: 2,
            distance: 2.3, // km
            scheduledDate: '2024-01-20',
            status: 'open',
            ngo: { name: 'Food Relief NGO' }
          },
          {
            _id: '2',
            title: 'Medical Camp Setup',
            description: 'Assist in setting up a health checkup camp',
            category: 'Healthcare',
            urgencyScore: 72,
            skillsRequired: ['First Aid', 'Organization'],
            location: { type: 'Point', coordinates: [77.2295, 28.6358] },
            locationName: 'Karol Bagh, New Delhi',
            volunteersNeeded: 3,
            volunteersAssigned: 1,
            distance: 4.1,
            scheduledDate: '2024-01-22',
            status: 'open',
            ngo: { name: 'HealthCare Foundation' }
          },
          {
            _id: '3',
            title: 'Education Material Distribution',
            description: 'Distribute books and stationery to students',
            category: 'Education',
            urgencyScore: 60,
            skillsRequired: ['Communication', 'Teaching'],
            location: { type: 'Point', coordinates: [77.1025, 28.7041] },
            locationName: 'Rohini, New Delhi',
            volunteersNeeded: 4,
            volunteersAssigned: 0,
            distance: 8.5,
            scheduledDate: '2024-01-25',
            status: 'open',
            ngo: { name: 'Edu Foundation' }
          }
        ],
        myAssignedTasks: [
          {
            _id: '4',
            title: 'Elderly Care Visit',
            description: 'Visit and assist elderly residents',
            category: 'Healthcare',
            urgencyScore: 55,
            location: { type: 'Point', coordinates: [77.2167, 28.6448] },
            locationName: 'Rajendra Place, New Delhi',
            scheduledDate: '2024-01-18',
            status: 'in-progress',
            assignedDate: '2024-01-15',
            ngo: { name: 'Senior Care NGO' }
          }
        ]
      }

      setTasks(mockData.availableTasks)
      setMyTasks(mockData.myAssignedTasks)
    } catch (err) {
      console.error('Error fetching volunteer data:', err)
    } finally {
      setLoading(false)
    }
  }

  const initMap = () => {
    if (!mapContainer.current || map.current) return

    const userLoc = user?.location?.coordinates || [77.2090, 28.6139]
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: userLoc,
      zoom: 11,
    })

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')

    // User location marker
    new mapboxgl.Marker({ color: '#10B981' })
      .setLngLat(userLoc)
      .setPopup(new mapboxgl.Popup().setHTML(`
        <div style="padding:8px;">
          <h3 style="font-weight:bold;font-size:14px;margin:0;">📍 You are here</h3>
          <p style="font-size:12px;color:#666;margin:4px 0 0 0;">${user?.locationName || 'Your location'}</p>
        </div>
      `))
      .addTo(map.current)

    // Task markers
    tasks.forEach(task => {
      if (task.location?.coordinates) {
        const el = document.createElement('div')
        el.className = 'task-marker'
        el.style.cssText = `
          width:40px;
          height:40px;
          background:${task.urgencyScore >= 75 ? '#EF4444' : task.urgencyScore >= 50 ? '#F59E0B' : '#3B82F6'};
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
        el.innerHTML = getTaskIcon(task.category)

        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div style="padding:10px;min-width:200px;">
            <h3 style="font-weight:bold;font-size:14px;margin:0 0 4px 0;">${task.title}</h3>
            <p style="font-size:12px;color:#666;margin:0 0 6px 0;">${task.description}</p>
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
              <span style="background:#EF4444;color:white;padding:2px 6px;border-radius:4px;font-size:10px;">
                ${task.urgencyScore}/100
              </span>
              <span style="font-size:11px;color:#666;">${task.distance} km away</span>
            </div>
            <p style="font-size:11px;color:#999;margin:4px 0;">
              ${task.volunteersNeeded - task.volunteersAssigned} volunteers needed
            </p>
          </div>
        `)

        new mapboxgl.Marker(el)
          .setLngLat(task.location.coordinates)
          .setPopup(popup)
          .addTo(map.current)
      }
    })
  }

  const getTaskIcon = (category) => {
    const icons = {
      'Food Security': '🍽️',
      'Healthcare': '🏥',
      'Education': '📚',
      'Environment': '🌳',
      'Disaster Relief': '🚨',
      'Community Development': '🏘️'
    }
    return icons[category] || '📋'
  }

  const handleApplyTask = async (taskId) => {
    setActionLoading(taskId)
    try {
      // TODO: API call to apply for task
      await new Promise(resolve => setTimeout(resolve, 1000))
      alert('Application submitted! The NGO will review and assign you.')
      await fetchVolunteerData()
    } catch (err) {
      alert('Failed to apply: ' + err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleCompleteTask = async (taskId) => {
    setActionLoading(taskId)
    try {
      // TODO: API call to mark task complete
      await new Promise(resolve => setTimeout(resolve, 1000))
      alert('Task marked complete! Thanks for your contribution.')
      await fetchVolunteerData()
    } catch (err) {
      alert('Failed: ' + err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const getSkillMatch = (taskSkills) => {
    if (!user?.volunteerProfile?.skills || !taskSkills) return 0
    const matches = taskSkills.filter(s => 
      user.volunteerProfile.skills.includes(s)
    ).length
    return Math.round((matches / taskSkills.length) * 100)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="text-gray-500 mt-4">Loading opportunities...</p>
        </div>
      </div>
    )
  }

  const tabs = [
    { key: 'overview', label: 'Overview', icon: '📊' },
    { key: 'available', label: 'Available Tasks', icon: '📋', badge: tasks.length },
    { key: 'my-tasks', label: 'My Tasks', icon: '✅', badge: myTasks.length },
    { key: 'map', label: 'Map View', icon: '🗺️' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🙋</span>
          <div>
            <h1 className="font-bold text-gray-800">Volunteer Dashboard</h1>
            <p className="text-xs text-gray-500">
              📍 {user?.locationName || 'Location not set'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            Hi, {user?.fullName}
          </span>
          <button
            onClick={() => { logout(); navigate('/login') }}
            className="text-sm bg-red-50 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 font-medium"
          >
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
                  ? 'px-4 py-3 text-sm font-medium border-b-2 border-blue-600 text-blue-600 flex items-center gap-2 whitespace-nowrap'
                  : 'px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 flex items-center gap-2 whitespace-nowrap'
              }
            >
              <span>{tab.icon}</span>
              {tab.label}
              {tab.badge > 0 && (
                <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">
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
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                {
                  label: 'Tasks Done',
                  value: user?.volunteerProfile?.tasksCompleted || 0,
                  icon: '✅',
                  bg: 'bg-green-50',
                  color: 'text-green-600'
                },
                {
                  label: 'People Helped',
                  value: user?.volunteerProfile?.peopleHelped || 0,
                  icon: '❤️',
                  bg: 'bg-red-50',
                  color: 'text-red-600'
                },
                {
                  label: 'My Rating',
                  value: user?.volunteerProfile?.rating || '—',
                  icon: '⭐',
                  bg: 'bg-yellow-50',
                  color: 'text-yellow-600'
                },
                {
                  label: 'Active Tasks',
                  value: myTasks.length,
                  icon: '📋',
                  bg: 'bg-blue-50',
                  color: 'text-blue-600'
                },
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

            {/* Skills */}
            {user?.volunteerProfile?.skills?.length > 0 && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <span>🎯</span> My Skills
                </h3>
                <div className="flex flex-wrap gap-2">
                  {user.volunteerProfile.skills.map(s => (
                    <span key={s} className="bg-blue-100 text-blue-700 text-xs px-3 py-1.5 rounded-full font-medium">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Stats */}
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white">
                <h3 className="text-lg font-bold mb-2">🎯 Available Opportunities</h3>
                <p className="text-3xl font-bold mb-1">{tasks.length}</p>
                <p className="text-blue-100 text-sm">Tasks matching your location</p>
                <button
                  onClick={() => setActiveTab('available')}
                  className="mt-4 bg-white text-blue-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-50"
                >
                  View All →
                </button>
              </div>

              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white">
                <h3 className="text-lg font-bold mb-2">✅ My Active Tasks</h3>
                <p className="text-3xl font-bold mb-1">{myTasks.length}</p>
                <p className="text-green-100 text-sm">Tasks in progress</p>
                <button
                  onClick={() => setActiveTab('my-tasks')}
                  className="mt-4 bg-white text-green-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-50"
                >
                  View Tasks →
                </button>
              </div>
            </div>

            {/* Urgent Tasks Preview */}
            {tasks.filter(t => t.urgencyScore >= 75).length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-red-50">
                  <h3 className="font-semibold text-red-800 flex items-center gap-2">
                    <span>🚨</span> Urgent Opportunities
                  </h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {tasks.filter(t => t.urgencyScore >= 75).slice(0, 3).map(task => (
                    <div key={task._id} className="p-4 px-6 flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xl">{getTaskIcon(task.category)}</span>
                          <h4 className="font-medium text-gray-800">{task.title}</h4>
                          <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-medium">
                            {task.urgencyScore}/100
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{task.description}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          📍 {task.locationName} • {task.distance} km away
                        </p>
                      </div>
                      <button
                        onClick={() => handleApplyTask(task._id)}
                        disabled={actionLoading === task._id}
                        className="ml-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                      >
                        {actionLoading === task._id ? '...' : 'Apply Now'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════ AVAILABLE TASKS TAB ══════ */}
        {activeTab === 'available' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">
                Available Opportunities ({tasks.length})
              </h3>
              <div className="flex gap-2">
                <select className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>All Categories</option>
                  <option>Food Security</option>
                  <option>Healthcare</option>
                  <option>Education</option>
                  <option>Environment</option>
                </select>
                <select className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>Nearest First</option>
                  <option>Urgent First</option>
                  <option>Best Match</option>
                </select>
              </div>
            </div>

            {tasks.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
                <p className="text-5xl mb-3">🔍</p>
                <h3 className="text-lg font-semibold text-gray-800">No tasks available</h3>
                <p className="text-gray-500 text-sm mt-1">Check back soon for new opportunities</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {tasks.map(task => {
                  const skillMatch = getSkillMatch(task.skillsRequired)
                  return (
                    <div key={task._id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl">{getTaskIcon(task.category)}</span>
                            <div className="flex-1">
                              <h4 className="font-bold text-gray-800 text-lg">{task.title}</h4>
                              <p className="text-xs text-gray-500">{task.ngo.name}</p>
                            </div>
                            <span className={
                              task.urgencyScore >= 75 
                                ? 'bg-red-100 text-red-700 text-xs px-2.5 py-1 rounded-full font-medium'
                                : task.urgencyScore >= 50
                                ? 'bg-orange-100 text-orange-700 text-xs px-2.5 py-1 rounded-full font-medium'
                                : 'bg-blue-100 text-blue-700 text-xs px-2.5 py-1 rounded-full font-medium'
                            }>
                              Urgency: {task.urgencyScore}/100
                            </span>
                          </div>

                          <p className="text-sm text-gray-600 mb-3">{task.description}</p>

                          <div className="flex flex-wrap gap-2 mb-3">
                            <span className="bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-full">
                              📍 {task.distance} km away
                            </span>
                            <span className="bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-full">
                              📅 {new Date(task.scheduledDate).toLocaleDateString()}
                            </span>
                            <span className="bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-full">
                              👥 {task.volunteersNeeded - task.volunteersAssigned} needed
                            </span>
                            {skillMatch > 0 && (
                              <span className="bg-green-100 text-green-700 text-xs px-2.5 py-1 rounded-full font-medium">
                                ✓ {skillMatch}% Skill Match
                              </span>
                            )}
                          </div>

                          {task.skillsRequired?.length > 0 && (
                            <div className="mb-2">
                              <p className="text-xs font-medium text-gray-600 mb-1">Skills needed:</p>
                              <div className="flex flex-wrap gap-1">
                                {task.skillsRequired.map(skill => {
                                  const hasSkill = user?.volunteerProfile?.skills?.includes(skill)
                                  return (
                                    <span
                                      key={skill}
                                      className={
                                        hasSkill
                                          ? 'bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full'
                                          : 'bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full'
                                      }
                                    >
                                      {hasSkill && '✓ '}{skill}
                                    </span>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          <p className="text-xs text-gray-400">
                            📍 {task.locationName}
                          </p>
                        </div>

                        <button
                          onClick={() => handleApplyTask(task._id)}
                          disabled={actionLoading === task._id}
                          className="px-6 py-2.5 bg-blue-600 text-white text-sm rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                        >
                          {actionLoading === task._id ? 'Applying...' : 'Apply Now'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════ MY TASKS TAB ══════ */}
        {activeTab === 'my-tasks' && (
          <div>
            <div className="mb-4">
              <h3 className="text-xl font-bold text-gray-800">My Tasks ({myTasks.length})</h3>
              <p className="text-sm text-gray-500">Tasks you're currently working on</p>
            </div>

            {myTasks.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
                <p className="text-5xl mb-3">📋</p>
                <h3 className="text-lg font-semibold text-gray-800">No active tasks</h3>
                <p className="text-gray-500 text-sm mt-1 mb-4">
                  Browse available opportunities and apply to get started
                </p>
                <button
                  onClick={() => setActiveTab('available')}
                  className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700"
                >
                  Browse Tasks →
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {myTasks.map(task => (
                  <div key={task._id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">{getTaskIcon(task.category)}</span>
                          <div className="flex-1">
                            <h4 className="font-bold text-gray-800 text-lg">{task.title}</h4>
                            <p className="text-xs text-gray-500">{task.ngo.name}</p>
                          </div>
                          <span className="bg-blue-100 text-blue-700 text-xs px-2.5 py-1 rounded-full font-medium capitalize">
                            {task.status}
                          </span>
                        </div>

                        <p className="text-sm text-gray-600 mb-3">{task.description}</p>

                        <div className="flex flex-wrap gap-2 mb-2">
                          <span className="bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-full">
                            📅 Scheduled: {new Date(task.scheduledDate).toLocaleDateString()}
                          </span>
                          <span className="bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-full">
                            ✅ Assigned: {new Date(task.assignedDate).toLocaleDateString()}
                          </span>
                        </div>

                        <p className="text-xs text-gray-400">
                          📍 {task.locationName}
                        </p>
                      </div>

                      <button
                        onClick={() => handleCompleteTask(task._id)}
                        disabled={actionLoading === task._id}
                        className="px-6 py-2.5 bg-green-600 text-white text-sm rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 whitespace-nowrap"
                      >
                        {actionLoading === task._id ? 'Saving...' : '✓ Mark Complete'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════ MAP TAB ══════ */}
        {activeTab === 'map' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-800">🗺️ Opportunities Near You</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  🟢 Your Location &nbsp;&nbsp; 
                  🔴 High Priority &nbsp;&nbsp; 
                  🟠 Medium &nbsp;&nbsp; 
                  🔵 Normal
                </p>
              </div>
              <span className="text-sm text-gray-500">{tasks.length} opportunities</span>
            </div>
            <div ref={mapContainer} className="w-full h-[600px]" />

            {/* Task list below map */}
            <div className="border-t border-gray-100 divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {tasks.map(task => (
                <div key={task._id} className="p-4 px-6 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-xl">{getTaskIcon(task.category)}</span>
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{task.title}</p>
                      <p className="text-xs text-gray-500">{task.locationName} • {task.distance} km</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={
                      task.urgencyScore >= 75 ? 'text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full'
                      : task.urgencyScore >= 50 ? 'text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full'
                      : 'text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full'
                    }>
                      {task.urgencyScore}
                    </span>
                    <button
                      onClick={() => handleApplyTask(task._id)}
                      disabled={actionLoading === task._id}
                      className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}