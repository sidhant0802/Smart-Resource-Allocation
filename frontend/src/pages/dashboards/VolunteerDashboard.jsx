import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import volunteerApi from '../../api/volunteerApi'
import taskApi from '../../api/taskApi'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

export default function VolunteerDashboard() {
  const { user, logout, updateUser } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState('overview')
  const [tasks, setTasks] = useState([])
  const [myCurrentTask, setMyCurrentTask] = useState(null)
  const [taskHistory, setTaskHistory] = useState([])
  const [pendingTasks, setPendingTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [availabilityStatus, setAvailabilityStatus] = useState('FREE')
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  // Profile editing
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [profileData, setProfileData] = useState({
    fullName: '',
    phoneNumber: '',
    bio: '',
    skills: [],
    interests: [],
    maxDistance: 50
  })
  const [newSkill, setNewSkill] = useState('')
  const [newInterest, setNewInterest] = useState('')

  // Location
  const [isEditingLocation, setIsEditingLocation] = useState(false)
  const [locationLoading, setLocationLoading] = useState(false)
  const [currentLocation, setCurrentLocation] = useState({
    coordinates: user?.location?.coordinates || [77.2090, 28.6139],
    locationName: user?.locationName || ''
  })
  const [locationSearch, setLocationSearch] = useState('')
  const [locationSuggestions, setLocationSuggestions] = useState([])

  const mapContainer = useRef(null)
  const map = useRef(null)
  const locationMapContainer = useRef(null)
  const locationMap = useRef(null)
  const locationMarker = useRef(null)

  useEffect(() => {
    fetchVolunteerData()
  }, [])

  useEffect(() => {
    if (user) {
      setProfileData({
        fullName: user.fullName || '',
        phoneNumber: user.phone || '',
        bio: '',
        skills: user.volunteerProfile?.skills || [],
        interests: user.volunteerProfile?.taskPreferences || [],
        maxDistance: 50
      })
      setCurrentLocation({
        coordinates: user.location?.coordinates || [77.2090, 28.6139],
        locationName: user.locationName || ''
      })
    }
  }, [user])

  useEffect(() => {
    if (activeTab === 'map' && !map.current && mapContainer.current && tasks.length > 0) {
      initTaskMap()
    }
  }, [activeTab, tasks])

  // Location map for profile editing
  useEffect(() => {
    if (isEditingLocation && locationMapContainer.current && !locationMap.current) {
      initLocationMap()
    }
    return () => {
      if (!isEditingLocation && locationMap.current) {
        locationMap.current.remove()
        locationMap.current = null
        locationMarker.current = null
      }
    }
  }, [isEditingLocation])

  const showSuccess = (msg) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 3000)
  }

  const fetchVolunteerData = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await volunteerApi.getDashboardData()

      if (response.success && response.data) {
        setAvailabilityStatus(response.data.availabilityStatus || 'FREE')
        setMyCurrentTask(response.data.currentTask || null)
        setTasks(response.data.availableTasks || [])
        setTaskHistory(response.data.completedTasks || [])
        setPendingTasks(response.data.pendingTasks || [])

        // Update profile data from server
        if (response.data.profile) {
          setProfileData(prev => ({
            ...prev,
            bio: response.data.profile.bio || prev.bio,
            phoneNumber: response.data.profile.phoneNumber || prev.phoneNumber,
            skills: response.data.profile.skills || prev.skills,
            interests: response.data.profile.interests || prev.interests,
            maxDistance: response.data.profile.maxDistance || prev.maxDistance
          }))
          setCurrentLocation({
            coordinates: response.data.profile.location?.coordinates || currentLocation.coordinates,
            locationName: response.data.profile.locationName || currentLocation.locationName
          })
        }
      }
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Failed to load data. Please refresh.')
    } finally {
      setLoading(false)
    }
  }

  // ═══════════════════════════════════════
  // PROFILE HANDLERS
  // ═══════════════════════════════════════

  const handleProfileUpdate = async (e) => {
    e.preventDefault()
    setActionLoading('profile')
    try {
      const response = await volunteerApi.updateProfile({
        fullName: profileData.fullName,
        phoneNumber: profileData.phoneNumber,
        bio: profileData.bio,
        skills: profileData.skills,
        interests: profileData.interests,
        maxDistance: profileData.maxDistance
      })

      if (response.success) {
        // Update auth context
        if (response.data?.user) {
          updateUser(response.data.user)
        }
        showSuccess('Profile updated successfully!')
        setIsEditingProfile(false)
        await fetchVolunteerData()
      }
    } catch (err) {
      alert('❌ Failed to update profile: ' + err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleAddSkill = () => {
    if (newSkill.trim() && !profileData.skills.includes(newSkill.trim())) {
      setProfileData(prev => ({ ...prev, skills: [...prev.skills, newSkill.trim()] }))
      setNewSkill('')
    }
  }

  const handleRemoveSkill = (skillToRemove) => {
    setProfileData(prev => ({
      ...prev,
      skills: prev.skills.filter(s => s !== skillToRemove)
    }))
  }

  const handleAddInterest = () => {
    if (newInterest.trim() && !profileData.interests.includes(newInterest.trim())) {
      setProfileData(prev => ({ ...prev, interests: [...prev.interests, newInterest.trim()] }))
      setNewInterest('')
    }
  }

  const handleRemoveInterest = (interestToRemove) => {
    setProfileData(prev => ({
      ...prev,
      interests: prev.interests.filter(i => i !== interestToRemove)
    }))
  }

  // ═══════════════════════════════════════
  // LOCATION HANDLERS
  // ═══════════════════════════════════════

  const handleGetLiveLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser')
      return
    }

    setLocationLoading(true)

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords
        const coordinates = [longitude, latitude]

        // Reverse geocode to get address
        try {
          const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${mapboxgl.accessToken}`
          )
          const data = await response.json()
          const placeName = data.features?.[0]?.place_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`

          setCurrentLocation({ coordinates, locationName: placeName })
          setLocationSearch(placeName)

          // Update marker on map
          if (locationMap.current && locationMarker.current) {
            locationMarker.current.setLngLat(coordinates)
            locationMap.current.flyTo({ center: coordinates, zoom: 14 })
          }
        } catch (err) {
          setCurrentLocation({
            coordinates,
            locationName: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
          })
        }

        setLocationLoading(false)
      },
      (err) => {
        alert('Failed to get location: ' + err.message)
        setLocationLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handleLocationSearch = async (query) => {
    setLocationSearch(query)
    if (query.length < 3) {
      setLocationSuggestions([])
      return
    }

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxgl.accessToken}&limit=5&country=in`
      )
      const data = await response.json()
      setLocationSuggestions(data.features || [])
    } catch (err) {
      console.error('Search error:', err)
    }
  }

  const handleSelectLocation = (feature) => {
    const [lng, lat] = feature.center
    const coordinates = [lng, lat]

    setCurrentLocation({ coordinates, locationName: feature.place_name })
    setLocationSearch(feature.place_name)
    setLocationSuggestions([])

    if (locationMap.current && locationMarker.current) {
      locationMarker.current.setLngLat(coordinates)
      locationMap.current.flyTo({ center: coordinates, zoom: 14 })
    }
  }

  const handleSaveLocation = async () => {
    setActionLoading('location')
    try {
      const response = await volunteerApi.updateLocation(
        currentLocation.coordinates,
        currentLocation.locationName
      )

      if (response.success) {
        updateUser({
          location: { type: 'Point', coordinates: currentLocation.coordinates },
          locationName: currentLocation.locationName
        })
        showSuccess('Location updated successfully!')
        setIsEditingLocation(false)
        await fetchVolunteerData()
      }
    } catch (err) {
      alert('❌ Failed to update location: ' + err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const initLocationMap = () => {
    if (!locationMapContainer.current || locationMap.current) return

    const center = currentLocation.coordinates

    locationMap.current = new mapboxgl.Map({
      container: locationMapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: center,
      zoom: 12
    })

    locationMap.current.addControl(new mapboxgl.NavigationControl(), 'top-right')

    locationMarker.current = new mapboxgl.Marker({ color: '#3B82F6', draggable: true })
      .setLngLat(center)
      .addTo(locationMap.current)

    // When marker is dragged
    locationMarker.current.on('dragend', async () => {
      const lngLat = locationMarker.current.getLngLat()
      const coordinates = [lngLat.lng, lngLat.lat]

      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${lngLat.lng},${lngLat.lat}.json?access_token=${mapboxgl.accessToken}`
        )
        const data = await response.json()
        const placeName = data.features?.[0]?.place_name || `${lngLat.lat.toFixed(4)}, ${lngLat.lng.toFixed(4)}`

        setCurrentLocation({ coordinates, locationName: placeName })
        setLocationSearch(placeName)
      } catch (err) {
        setCurrentLocation({
          coordinates,
          locationName: `${lngLat.lat.toFixed(4)}, ${lngLat.lng.toFixed(4)}`
        })
      }
    })

    // Click on map to move marker
    locationMap.current.on('click', async (e) => {
      const coordinates = [e.lngLat.lng, e.lngLat.lat]
      locationMarker.current.setLngLat(coordinates)

      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${e.lngLat.lng},${e.lngLat.lat}.json?access_token=${mapboxgl.accessToken}`
        )
        const data = await response.json()
        const placeName = data.features?.[0]?.place_name || `${e.lngLat.lat.toFixed(4)}, ${e.lngLat.lng.toFixed(4)}`

        setCurrentLocation({ coordinates, locationName: placeName })
        setLocationSearch(placeName)
      } catch (err) {
        setCurrentLocation({
          coordinates,
          locationName: `${e.lngLat.lat.toFixed(4)}, ${e.lngLat.lng.toFixed(4)}`
        })
      }
    })
  }

  // ═══════════════════════════════════════
  // TASK MAP
  // ═══════════════════════════════════════

  const initTaskMap = () => {
    if (!mapContainer.current || map.current) return

    const userLoc = currentLocation.coordinates

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: userLoc,
      zoom: 11
    })

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')

    new mapboxgl.Marker({ color: '#10B981' })
      .setLngLat(userLoc)
      .setPopup(new mapboxgl.Popup().setHTML('<div style="padding:8px;"><h3 style="font-weight:bold;">📍 You</h3></div>'))
      .addTo(map.current)

    tasks.forEach(task => {
      if (task.location?.coordinates) {
        const color = task.urgencyScore >= 75 ? '#EF4444' : task.urgencyScore >= 50 ? '#F59E0B' : '#3B82F6'
        const el = document.createElement('div')
        el.style.cssText = `width:45px;height:45px;background:${color};border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:20px;border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.3);cursor:pointer;`
        el.innerHTML = getTaskIcon(task.category)

        new mapboxgl.Marker(el)
          .setLngLat(task.location.coordinates)
          .setPopup(new mapboxgl.Popup().setHTML(`
            <div style="padding:12px;min-width:220px;">
              <h3 style="font-weight:bold;margin:0 0 6px 0;">${task.title}</h3>
              <p style="font-size:12px;color:#666;margin:0;">${task.description || ''}</p>
            </div>
          `))
          .addTo(map.current)
      }
    })
  }

  const getTaskIcon = (category) => {
    const icons = {
      'Food Security': '🍽️', 'Healthcare': '🏥', 'Education': '📚',
      'Environment': '🌳', 'Disaster Relief': '🚨', 'Community Development': '🏘️'
    }
    return icons[category] || '📋'
  }

  // ═══════════════════════════════════════
  // TASK ACTIONS
  // ═══════════════════════════════════════

  const handleApplyTask = async (taskId) => {
  try {
    await volunteerApi.applyToTask(taskId)
    // or: await taskApi.applyToTask(taskId)
    alert('✅ Application submitted! Awaiting approval.')
    // refresh data
  } catch (error) {
    if (error.message.includes('Already')) {
      alert('ℹ️ You already applied for this task. Waiting for approval.')
    } else {
      alert('❌ ' + error.message)
    }
  }
}

  const handleCompleteTask = async () => {
    if (!myCurrentTask) return
    setActionLoading('complete')
    try {
      const response = await taskApi.completeTask(myCurrentTask._id, {
        rating: 5,
        feedback: 'Great task!'
      })
      if (response.success) {
        showSuccess('Task completed successfully!')
        await fetchVolunteerData()
      }
    } catch (err) {
      alert('❌ ' + err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const getSkillMatch = (taskSkills) => {
    if (!profileData.skills?.length || !taskSkills?.length) return 0
    const matches = taskSkills.filter(s => profileData.skills.includes(s)).length
    return Math.round((matches / taskSkills.length) * 100)
  }

  const getStatusColor = (status) => {
    if (status === 'FREE') return { bg: 'bg-green-100', text: 'text-green-700', icon: '🟢' }
    if (status === 'BUSY') return { bg: 'bg-red-100', text: 'text-red-700', icon: '🔴' }
    return { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: '⏳' }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  const statusColor = getStatusColor(availabilityStatus)

  const tabs = [
    { key: 'overview', label: 'Overview', icon: '📊' },
    { key: 'available', label: 'Tasks', icon: '🎯', badge: tasks.length },
    { key: 'pending', label: 'Pending', icon: '⏳', badge: pendingTasks.length },
    { key: 'active', label: 'Active', icon: '🔥', badge: myCurrentTask ? 1 : 0 },
    { key: 'history', label: 'History', icon: '📜', badge: taskHistory.length },
    { key: 'profile', label: 'Profile', icon: '👤' },
    { key: 'map', label: 'Map', icon: '🗺️' }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">

      {/* Navbar */}
      <nav className="bg-white shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-2xl shadow-lg">🙋</div>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-gray-800">Volunteer</h1>
                <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">📍 {currentLocation.locationName || 'Location not set'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full font-medium text-xs ${statusColor.bg} ${statusColor.text}`}>
                <span>{statusColor.icon}</span>
                <span className="hidden sm:inline">{availabilityStatus}</span>
              </div>
              <span className="hidden md:inline text-sm text-gray-700 font-medium">{user?.fullName?.split(' ')[0]}</span>
              <button onClick={() => { logout(); navigate('/login') }} className="px-3 sm:px-4 py-2 bg-red-600 text-white rounded-lg font-medium text-xs sm:text-sm">
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Success / Error Alerts */}
      {successMsg && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-3 m-4 rounded text-sm animate-pulse">
          <p>✅ {successMsg}</p>
        </div>
      )}
      {error && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-3 m-4 rounded text-sm">
          <p className="font-bold">⚠️ Note</p>
          <p>{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-14 sm:top-20 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-2 sm:px-6">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); if (tab.key !== 'map' && map.current) { map.current.remove(); map.current = null } }}
                className={`px-3 sm:px-5 py-3 text-xs sm:text-sm font-medium whitespace-nowrap flex items-center gap-2 border-b-2 transition-all ${
                  activeTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                <span>{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.badge > 0 && <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{tab.badge}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">

        {/* ════════ OVERVIEW ════════ */}
        {activeTab === 'overview' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {[
                { label: 'Completed', value: taskHistory.length, icon: '✅', color: 'from-green-500 to-green-600' },
                { label: 'Pending', value: pendingTasks.length, icon: '⏳', color: 'from-yellow-500 to-yellow-600' },
                { label: 'Rating', value: `${(profileData.rating || 4.5).toFixed(1)}/5`, icon: '⭐', color: 'from-orange-500 to-orange-600' },
                { label: 'Hours', value: taskHistory.reduce((s, t) => s + (t.duration || 0) * 8, 0), icon: '⏱️', color: 'from-purple-500 to-purple-600' }
              ].map((card, i) => (
                <div key={i} className={`bg-gradient-to-br ${card.color} rounded-xl p-4 sm:p-6 text-white shadow-lg`}>
                  <p className="text-xs opacity-90">{card.label}</p>
                  <p className="text-2xl sm:text-3xl font-bold mt-1">{card.value}</p>
                  <span className="text-3xl opacity-20 float-right -mt-8">{card.icon}</span>
                </div>
              ))}
            </div>

            {/* Location Card */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-md">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base sm:text-lg font-bold text-gray-800">📍 Your Location</h3>
                <button onClick={() => { setIsEditingLocation(true); setActiveTab('profile') }} className="text-blue-600 text-sm font-medium hover:underline">
                  Update →
                </button>
              </div>
              <p className="text-sm text-gray-600">{currentLocation.locationName || 'Location not set. Update your location to see nearby tasks.'}</p>
            </div>

            {profileData.skills.length > 0 && (
              <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-md">
                <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-3">🎯 Your Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {profileData.skills.map(skill => (
                    <span key={skill} className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium">✓ {skill}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
                <h3 className="text-xl font-bold mb-2">🎯 Available Tasks</h3>
                <p className="text-3xl font-bold mb-3">{tasks.length}</p>
                <button onClick={() => setActiveTab('available')} className="w-full bg-white text-blue-600 font-bold py-3 rounded-xl hover:bg-blue-50">
                  View Tasks →
                </button>
              </div>
              <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-6 text-white shadow-lg">
                <h3 className="text-xl font-bold mb-2">📊 Completed</h3>
                <p className="text-3xl font-bold mb-3">{taskHistory.length}</p>
                <button onClick={() => setActiveTab('history')} className="w-full bg-white text-indigo-600 font-bold py-3 rounded-xl hover:bg-indigo-50">
                  View History →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ════════ AVAILABLE TASKS ════════ */}
        {activeTab === 'available' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Available Tasks</h2>
              <select onChange={(e) => { if (e.target.value) setTasks(prev => [...prev].sort((a, b) => e.target.value === 'urgent' ? b.urgencyScore - a.urgencyScore : (a.distance || 0) - (b.distance || 0))) }} className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">Sort By...</option>
                <option value="urgent">Most Urgent</option>
                <option value="nearest">Nearest</option>
              </select>
            </div>

            {availabilityStatus !== 'FREE' && (
              <div className="bg-orange-100 border-l-4 border-orange-500 text-orange-700 p-4 rounded-lg">
                <p className="font-bold">⚠️ You are currently {availabilityStatus}</p>
                <p className="text-sm">Complete your current task before applying to new ones.</p>
              </div>
            )}

            {tasks.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 sm:p-16 text-center shadow-md">
                <p className="text-5xl sm:text-6xl mb-4">🔍</p>
                <h3 className="text-lg sm:text-xl font-bold text-gray-800">No tasks available</h3>
                <p className="text-sm text-gray-500 mt-2">{availabilityStatus !== 'FREE' ? 'Complete your current task to see new ones.' : 'Check back later.'}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {tasks.map(task => {
                  const skillMatch = getSkillMatch(task.skillsRequired)
                  return (
                    <div key={task._id} className="bg-white rounded-2xl p-4 sm:p-6 shadow-md hover:shadow-lg transition-all border-l-4 border-blue-500">
                      <div className="flex flex-col lg:flex-row items-start gap-4 lg:gap-6">
                        <div className="flex-1 w-full">
                          <div className="flex items-start gap-3 mb-3">
                            <span className="text-3xl">{getTaskIcon(task.category)}</span>
                            <div className="flex-1">
                              <h4 className="text-base sm:text-lg font-bold text-gray-800">{task.title}</h4>
                              <p className="text-xs sm:text-sm text-gray-500">{task.ngo?.name || 'Unknown NGO'}</p>
                            </div>
                            <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-bold ${task.urgencyScore >= 75 ? 'bg-red-100 text-red-700' : task.urgencyScore >= 50 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                              ⚡{task.urgencyScore}
                            </span>
                          </div>
                          <p className="text-sm sm:text-base text-gray-700 mb-4">{task.description}</p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                            <div className="bg-gray-100 rounded-lg p-2 sm:p-3 text-center">
                              <p className="text-xs text-gray-600">Duration</p>
                              <p className="font-bold text-sm sm:text-base text-gray-800">{task.duration}d</p>
                            </div>
                            <div className="bg-gray-100 rounded-lg p-2 sm:p-3 text-center">
                              <p className="text-xs text-gray-600">Distance</p>
                              <p className="font-bold text-sm sm:text-base text-gray-800">{task.distance || '?'}km</p>
                            </div>
                            <div className="bg-gray-100 rounded-lg p-2 sm:p-3 text-center">
                              <p className="text-xs text-gray-600">Spots Left</p>
                              <p className="font-bold text-sm sm:text-base text-gray-800">{task.volunteersNeeded - (task.volunteersAssigned || 0)}</p>
                            </div>
                            {skillMatch > 0 && (
                              <div className="bg-green-100 rounded-lg p-2 sm:p-3 text-center">
                                <p className="text-xs text-green-600">Match</p>
                                <p className="font-bold text-sm sm:text-base text-green-700">{skillMatch}%</p>
                              </div>
                            )}
                          </div>
                          {task.skillsRequired?.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-bold text-gray-600 mb-2">Skills:</p>
                              <div className="flex flex-wrap gap-1.5">
                                {task.skillsRequired.map(skill => (
                                  <span key={skill} className={`text-xs px-2 py-1 rounded-full font-medium ${profileData.skills?.includes(skill) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                    {profileData.skills?.includes(skill) ? '✓' : '○'} {skill}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          <p className="text-xs text-gray-400">📍 {task.locationName}</p>
                        </div>
                        <button
                          onClick={() => handleApplyTask(task._id)}
                          disabled={actionLoading === task._id || availabilityStatus !== 'FREE'}
                          className="w-full lg:w-auto px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                        >
                          {actionLoading === task._id ? '⏳ Applying...' : availabilityStatus !== 'FREE' ? '🔒 Busy' : '📩 Apply'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ════════ PENDING APPROVALS ════════ */}
        {activeTab === 'pending' && (
          <div className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Pending Applications</h2>
            <p className="text-sm text-gray-500">Tasks you've applied to, waiting for committee approval.</p>

            {pendingTasks.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 sm:p-16 text-center shadow-md">
                <p className="text-5xl sm:text-6xl mb-4">📬</p>
                <h3 className="text-lg sm:text-xl font-bold text-gray-800">No Pending Applications</h3>
                <p className="text-sm text-gray-500 mt-2">Apply to tasks to see them here.</p>
                <button onClick={() => setActiveTab('available')} className="mt-4 bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700">
                  Browse Tasks
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingTasks.map(task => (
                  <div key={task._id} className="bg-white rounded-2xl p-4 sm:p-6 shadow-md border-l-4 border-yellow-500">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{getTaskIcon(task.category)}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-base sm:text-lg font-bold text-gray-800">{task.title}</h4>
                            <p className="text-xs sm:text-sm text-gray-500">{task.ngo?.name || 'Unknown NGO'}</p>
                          </div>
                          <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                            ⏳ Awaiting Approval
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-2">{task.description}</p>
                        <div className="flex gap-3 mt-3 text-xs text-gray-500">
                          <span>📍 {task.locationName}</span>
                          <span>⏱️ {task.duration}d</span>
                          <span>⚡ {task.urgencyScore}/100</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════════ ACTIVE TASK ════════ */}
        {activeTab === 'active' && (
          <div>
            {!myCurrentTask ? (
              <div className="bg-white rounded-2xl p-12 sm:p-16 text-center shadow-md">
                <p className="text-5xl sm:text-6xl mb-4">⏳</p>
                <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-2">No Active Task</h3>
                <p className="text-sm sm:text-base text-gray-500 mb-6">You're not assigned to any task right now.</p>
                <button onClick={() => setActiveTab('available')} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700">
                  Browse Tasks
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden border-l-4 border-blue-500">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 sm:p-8 text-white">
                  <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4">
                    <div className="text-center sm:text-left">
                      <h3 className="text-xl sm:text-2xl font-bold">{myCurrentTask.title}</h3>
                      <p className="text-blue-100 mt-1">{myCurrentTask.ngo?.name || 'Unknown NGO'}</p>
                    </div>
                    <span className="text-4xl">{getTaskIcon(myCurrentTask.category)}</span>
                  </div>
                </div>
                <div className="p-6 sm:p-8">
                  <p className="text-sm sm:text-base text-gray-700 mb-6">{myCurrentTask.description}</p>
                  <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-8">
                    <div className="bg-blue-50 rounded-xl p-3 sm:p-4 text-center">
                      <p className="text-xs text-gray-600 font-bold">Duration</p>
                      <p className="text-xl sm:text-2xl font-bold text-blue-600 mt-1">{myCurrentTask.duration}d</p>
                    </div>
                    <div className="bg-green-50 rounded-xl p-3 sm:p-4 text-center">
                      <p className="text-xs text-gray-600 font-bold">Ends</p>
                      <p className="text-sm sm:text-xl font-bold text-green-600 mt-1">{new Date(myCurrentTask.endDate).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</p>
                    </div>
                    <div className="bg-purple-50 rounded-xl p-3 sm:p-4 text-center">
                      <p className="text-xs text-gray-600 font-bold">Location</p>
                      <p className="text-xs sm:text-sm font-bold text-purple-600 mt-1">{myCurrentTask.locationName?.split(',')[0] || 'Unknown'}</p>
                    </div>
                  </div>
                  <button onClick={handleCompleteTask} disabled={actionLoading === 'complete'} className="w-full bg-green-600 text-white font-bold py-3 sm:py-4 rounded-xl hover:bg-green-700 disabled:opacity-50 text-sm sm:text-lg">
                    {actionLoading === 'complete' ? '⏳ Completing...' : '✓ Mark Complete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════ HISTORY ════════ */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Task History</h2>
            {taskHistory.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 sm:p-16 text-center shadow-md">
                <p className="text-5xl sm:text-6xl mb-4">📜</p>
                <h3 className="text-lg sm:text-xl font-bold text-gray-800">No History Yet</h3>
                <p className="text-sm text-gray-500 mt-2">Complete tasks to build your history.</p>
                <button onClick={() => setActiveTab('available')} className="mt-4 bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700">
                  Browse Tasks
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {taskHistory.map(task => (
                  <div key={task._id} className="bg-white rounded-2xl p-4 sm:p-6 shadow-md hover:shadow-lg transition-all border-l-4 border-green-500">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{getTaskIcon(task.category)}</span>
                      <div className="flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <h4 className="text-base sm:text-lg font-bold text-gray-800">{task.title}</h4>
                            <p className="text-xs sm:text-sm text-gray-500">{task.ngo?.name || 'Unknown NGO'}</p>
                          </div>
                          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold self-start sm:self-auto">✓ Completed</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-2">{task.description}</p>
                        <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-500">
                          <span>📍 {task.locationName}</span>
                          <span>⏱️ {task.duration}d</span>
                          {task.completedAt && <span>📅 {new Date(task.completedAt).toLocaleDateString()}</span>}
                        </div>
                        {(task.rating > 0 || task.feedback) && (
                          <div className="flex items-center gap-3 mt-3">
                            <div className="flex gap-1">
                              {[...Array(5)].map((_, i) => (
                                <span key={i} className={i < Math.floor(task.rating || 0) ? 'text-base' : 'text-gray-300 text-base'}>⭐</span>
                              ))}
                            </div>
                            {task.feedback && <span className="text-xs sm:text-sm text-gray-600 italic">"{task.feedback}"</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════════ PROFILE ════════ */}
        {activeTab === 'profile' && (
          <div className="space-y-4 sm:space-y-6">
            {/* Profile Header */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl p-6 sm:p-8 text-white">
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white rounded-full flex items-center justify-center text-4xl sm:text-5xl">👤</div>
                <div className="flex-1 text-center sm:text-left">
                  <h2 className="text-2xl sm:text-3xl font-bold">{user?.fullName}</h2>
                  <p className="text-blue-100 text-sm sm:text-base mt-1">{user?.email}</p>
                  <p className="text-blue-200 text-xs mt-1">📍 {currentLocation.locationName || 'Location not set'}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setIsEditingProfile(!isEditingProfile)} className="bg-white text-blue-600 px-4 py-2 rounded-lg font-bold text-sm">
                    {isEditingProfile ? '✕ Cancel' : '✏️ Edit Profile'}
                  </button>
                  <button onClick={() => setIsEditingLocation(!isEditingLocation)} className="bg-blue-400 text-white px-4 py-2 rounded-lg font-bold text-sm">
                    {isEditingLocation ? '✕ Cancel' : '📍 Location'}
                  </button>
                </div>
              </div>
            </div>

            {/* Location Editor */}
            {isEditingLocation && (
              <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-md space-y-4">
                <h3 className="text-lg sm:text-xl font-bold text-gray-800">📍 Update Location</h3>

                {/* Live Location Button */}
                <button
                  onClick={handleGetLiveLocation}
                  disabled={locationLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 disabled:opacity-50"
                >
                  {locationLoading ? (
                    <><div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" /> Getting Location...</>
                  ) : (
                    <>📡 Use My Live Location</>
                  )}
                </button>

                {/* Search */}
                <div className="relative">
                  <input
                    type="text"
                    value={locationSearch}
                    onChange={(e) => handleLocationSearch(e.target.value)}
                    placeholder="Search for a location..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm pl-10"
                  />
                  <span className="absolute left-3 top-3 text-gray-400">🔍</span>

                  {locationSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl mt-1 shadow-lg z-50 max-h-60 overflow-y-auto">
                      {locationSuggestions.map(feature => (
                        <button
                          key={feature.id}
                          onClick={() => handleSelectLocation(feature)}
                          className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-100 text-sm"
                        >
                          <p className="font-medium text-gray-800">{feature.text}</p>
                          <p className="text-xs text-gray-500">{feature.place_name}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Current Location Display */}
                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-xs text-blue-600 font-bold mb-1">Selected Location:</p>
                  <p className="text-sm text-gray-800">{currentLocation.locationName || 'No location selected'}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Coordinates: {currentLocation.coordinates[1]?.toFixed(4)}, {currentLocation.coordinates[0]?.toFixed(4)}
                  </p>
                </div>

                {/* Map */}
                <div ref={locationMapContainer} className="w-full h-[300px] sm:h-[400px] rounded-xl overflow-hidden border border-gray-200" />
                <p className="text-xs text-gray-400 text-center">Click on map or drag marker to set location</p>

                {/* Save */}
                <button
                  onClick={handleSaveLocation}
                  disabled={actionLoading === 'location'}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50"
                >
                  {actionLoading === 'location' ? '⏳ Saving...' : '✓ Save Location'}
                </button>
              </div>
            )}

            {/* Profile Editor */}
            {isEditingProfile && !isEditingLocation && (
              <form onSubmit={handleProfileUpdate} className="bg-white rounded-2xl p-4 sm:p-6 shadow-md space-y-4">
                <h3 className="text-lg sm:text-xl font-bold text-gray-800">Edit Profile</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                  <input type="text" value={profileData.fullName} onChange={(e) => setProfileData(prev => ({ ...prev, fullName: e.target.value }))} className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm" required />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                  <input type="tel" value={profileData.phoneNumber} onChange={(e) => setProfileData(prev => ({ ...prev, phoneNumber: e.target.value }))} className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
                  <textarea value={profileData.bio} onChange={(e) => setProfileData(prev => ({ ...prev, bio: e.target.value }))} rows="3" className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Tell us about yourself..." />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max Distance (km)</label>
                  <input type="number" value={profileData.maxDistance} onChange={(e) => setProfileData(prev => ({ ...prev, maxDistance: parseInt(e.target.value) || 50 }))} className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm" min="1" max="200" />
                </div>

                {/* Skills */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Skills</label>
                  <div className="flex gap-2 mb-3">
                    <input type="text" value={newSkill} onChange={(e) => setNewSkill(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Add skill..." />
                    <button type="button" onClick={handleAddSkill} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">+</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {profileData.skills.map(skill => (
                      <span key={skill} className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2">
                        {skill} <button type="button" onClick={() => handleRemoveSkill(skill)} className="hover:text-red-600">✕</button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Interests */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Interests</label>
                  <div className="flex gap-2 mb-3">
                    <input type="text" value={newInterest} onChange={(e) => setNewInterest(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddInterest())} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Add interest..." />
                    <button type="button" onClick={handleAddInterest} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm">+</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {profileData.interests.map(interest => (
                      <span key={interest} className="bg-purple-100 text-purple-700 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2">
                        {interest} <button type="button" onClick={() => handleRemoveInterest(interest)} className="hover:text-red-600">✕</button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsEditingProfile(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
                  <button type="submit" disabled={actionLoading === 'profile'} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold disabled:opacity-50 text-sm">
                    {actionLoading === 'profile' ? '⏳ Saving...' : '✓ Save Profile'}
                  </button>
                </div>
              </form>
            )}

            {/* Profile View */}
            {!isEditingProfile && !isEditingLocation && (
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-md">
                    <h4 className="text-sm font-medium text-gray-600 mb-3">Contact Info</h4>
                    <div className="space-y-2 text-sm">
                      <p><strong>Email:</strong> {user?.email}</p>
                      <p><strong>Phone:</strong> {profileData.phoneNumber || 'Not set'}</p>
                      <p><strong>Location:</strong> {currentLocation.locationName || 'Not set'}</p>
                      <p><strong>Max Distance:</strong> {profileData.maxDistance}km</p>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-md">
                    <h4 className="text-sm font-medium text-gray-600 mb-3">Stats</h4>
                    <div className="space-y-2 text-sm">
                      <p><strong>Tasks Completed:</strong> {taskHistory.length}</p>
                      <p><strong>Rating:</strong> 4.5/5 ⭐</p>
                      <p><strong>Status:</strong> {availabilityStatus}</p>
                      <p><strong>Joined:</strong> {new Date(user?.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

                {profileData.bio && (
                  <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-md">
                    <h4 className="text-sm font-medium text-gray-600 mb-2">About</h4>
                    <p className="text-sm text-gray-700">{profileData.bio}</p>
                  </div>
                )}

                {profileData.skills.length > 0 && (
                  <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-md">
                    <h4 className="text-sm font-medium text-gray-600 mb-3">Skills</h4>
                    <div className="flex flex-wrap gap-2">
                      {profileData.skills.map(skill => (
                        <span key={skill} className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium">✓ {skill}</span>
                      ))}
                    </div>
                  </div>
                )}

                {profileData.interests.length > 0 && (
                  <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-md">
                    <h4 className="text-sm font-medium text-gray-600 mb-3">Interests</h4>
                    <div className="flex flex-wrap gap-2">
                      {profileData.interests.map(interest => (
                        <span key={interest} className="bg-purple-100 text-purple-700 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium">♥ {interest}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ════════ MAP ════════ */}
        {activeTab === 'map' && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="px-4 sm:px-8 py-4 sm:py-6 border-b bg-gray-50">
              <h2 className="text-lg sm:text-2xl font-bold text-gray-800">🗺️ Tasks Near You</h2>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">🟢 You • 🔴 High • 🟠 Medium • 🔵 Normal</p>
            </div>
            <div ref={mapContainer} className="w-full h-[400px] sm:h-[600px]" />
            <div className="border-t max-h-64 overflow-y-auto divide-y">
              {tasks.map(task => (
                <div key={task._id} className="p-3 sm:p-4 hover:bg-gray-50 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <span className="text-lg sm:text-xl">{getTaskIcon(task.category)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm sm:text-base text-gray-800 truncate">{task.title}</p>
                      <p className="text-xs text-gray-500">{task.locationName?.split(',')[0] || 'Unknown'} • {task.distance || '?'}km</p>
                    </div>
                  </div>
                  <button onClick={() => handleApplyTask(task._id)} disabled={actionLoading === task._id || availabilityStatus !== 'FREE'} className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white text-xs rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap">
                    {availabilityStatus !== 'FREE' ? '🔒' : 'Apply'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}