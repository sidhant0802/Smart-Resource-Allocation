import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import volunteerApi from '../../api/volunteerApi'
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

  // Track applied task IDs to prevent duplicates
  const [appliedTaskIds, setAppliedTaskIds] = useState([])

  // Assignment tracking (from email link)
  const [myAssignments, setMyAssignments] = useState([])
  const [loadingAssignments, setLoadingAssignments] = useState(false)

  // NGO Applications
  const [myNgos, setMyNgos] = useState([])
  const [allNgos, setAllNgos] = useState([])
  const [loadingNgos, setLoadingNgos] = useState(false)
  const [applyingNgoId, setApplyingNgoId] = useState(null)
  const [showNgoApplyModal, setShowNgoApplyModal] = useState(null)

  // Profile editing
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [profileData, setProfileData] = useState({
    fullName: '',
    phoneNumber: '',
    bio: '',
    skills: [],
    interests: [],
    maxDistance: 50,
    rating: 0
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

  // Task filter & sort
  const [taskSort, setTaskSort] = useState('')
  const [taskSearch, setTaskSearch] = useState('')
  const [taskCategoryFilter, setTaskCategoryFilter] = useState('')

  const mapContainer = useRef(null)
  const map = useRef(null)
  const locationMapContainer = useRef(null)
  const locationMap = useRef(null)
  const locationMarker = useRef(null)

  // ═══════════════════════════════════════
  // EFFECTS
  // ═══════════════════════════════════════

  useEffect(() => {
    fetchVolunteerData()
    fetchAppliedTaskIds()
    fetchMyAssignments()
    fetchMyNgos()
    fetchAllNgos()
  }, [])

  useEffect(() => {
    if (user) {
      setProfileData({
        fullName: user.fullName || '',
        phoneNumber: user.phone || '',
        bio: '',
        skills: user.volunteerProfile?.skills || [],
        interests: user.volunteerProfile?.taskPreferences || [],
        maxDistance: 50,
        rating: user.volunteerProfile?.rating || 0
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

  // ═══════════════════════════════════════
  // DATA FETCHERS
  // ═══════════════════════════════════════

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

        if (response.data.profile) {
          setProfileData(prev => ({
            ...prev,
            bio: response.data.profile.bio || prev.bio,
            phoneNumber: response.data.profile.phoneNumber || prev.phoneNumber,
            skills: response.data.profile.skills || prev.skills,
            interests: response.data.profile.interests || prev.interests,
            maxDistance: response.data.profile.maxDistance || prev.maxDistance,
            rating: response.data.profile.rating || prev.rating
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

  const fetchAppliedTaskIds = async () => {
    try {
      const res = await volunteerApi.getAppliedTaskIds()
      setAppliedTaskIds(res.taskIds || [])
    } catch (err) {
      console.error('Error fetching applied task IDs:', err)
    }
  }

  const fetchMyAssignments = async () => {
    setLoadingAssignments(true)
    try {
      const res = await volunteerApi.getMyAssignments()
      setMyAssignments(res.assignments || [])
    } catch (err) {
      console.error('Error fetching assignments:', err)
    } finally {
      setLoadingAssignments(false)
    }
  }

  const fetchMyNgos = async () => {
    try {
      const res = await volunteerApi.getMyNGOs()
      setMyNgos(res.data || [])
    } catch (err) {
      console.error('Error fetching my NGOs:', err)
    }
  }

  const fetchAllNgos = async () => {
    setLoadingNgos(true)
    try {
      const res = await volunteerApi.getAllNgos()
      setAllNgos(res.ngos || [])
    } catch (err) {
      console.error('Error fetching all NGOs:', err)
    } finally {
      setLoadingNgos(false)
    }
  }

  const handleApplyToNgo = async (ngoId) => {
    setApplyingNgoId(ngoId)
    try {
      await volunteerApi.applyToNGO(ngoId)
      showSuccess('✅ Application submitted to NGO!')
      setShowNgoApplyModal(null)
      await fetchMyNgos()
      await fetchAllNgos()
      await fetchVolunteerData()
    } catch (err) {
      alert('❌ ' + err.message)
    } finally {
      setApplyingNgoId(null)
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
        if (response.data?.user) updateUser(response.data.user)
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

  const handleRemoveSkill = (skill) => {
    setProfileData(prev => ({ ...prev, skills: prev.skills.filter(s => s !== skill) }))
  }

  const handleAddInterest = () => {
    if (newInterest.trim() && !profileData.interests.includes(newInterest.trim())) {
      setProfileData(prev => ({ ...prev, interests: [...prev.interests, newInterest.trim()] }))
      setNewInterest('')
    }
  }

  const handleRemoveInterest = (interest) => {
    setProfileData(prev => ({ ...prev, interests: prev.interests.filter(i => i !== interest) }))
  }

  // ═══════════════════════════════════════
  // LOCATION HANDLERS
  // ═══════════════════════════════════════

  const handleGetLiveLocation = () => {
    if (!navigator.geolocation) { alert('Geolocation is not supported'); return }
    setLocationLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords
        const coordinates = [longitude, latitude]
        try {
          const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${mapboxgl.accessToken}`
          )
          const data = await response.json()
          const placeName = data.features?.[0]?.place_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
          setCurrentLocation({ coordinates, locationName: placeName })
          setLocationSearch(placeName)
          if (locationMap.current && locationMarker.current) {
            locationMarker.current.setLngLat(coordinates)
            locationMap.current.flyTo({ center: coordinates, zoom: 14 })
          }
        } catch {
          setCurrentLocation({ coordinates, locationName: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` })
        }
        setLocationLoading(false)
      },
      (err) => { alert('Failed to get location: ' + err.message); setLocationLoading(false) },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handleLocationSearch = async (query) => {
    setLocationSearch(query)
    if (query.length < 3) { setLocationSuggestions([]); return }
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxgl.accessToken}&limit=5&country=in`
      )
      const data = await response.json()
      setLocationSuggestions(data.features || [])
    } catch (err) { console.error('Search error:', err) }
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
      center,
      zoom: 12
    })
    locationMap.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
    locationMarker.current = new mapboxgl.Marker({ color: '#3B82F6', draggable: true })
      .setLngLat(center)
      .addTo(locationMap.current)

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
      } catch {
        setCurrentLocation({ coordinates, locationName: `${lngLat.lat.toFixed(4)}, ${lngLat.lng.toFixed(4)}` })
      }
    })

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
      } catch {
        setCurrentLocation({ coordinates, locationName: `${e.lngLat.lat.toFixed(4)}, ${e.lngLat.lng.toFixed(4)}` })
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
              <p style="font-size:12px;color:#666;margin:0 0 8px;">${task.description || ''}</p>
              <p style="font-size:11px;color:#999;margin:0;">📍 ${task.locationName || ''}</p>
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
    if (appliedTaskIds.includes(taskId)) {
      showSuccess('ℹ️ You already applied for this task!')
      return
    }

    if (availabilityStatus !== 'FREE') {
      alert('⚠️ You are currently busy. Complete your active task first.')
      return
    }

    // Check if user has any approved NGO
    const hasApprovedNgo = myNgos.some(n => n.status === 'approved')
    if (!hasApprovedNgo) {
      alert('⚠️ You need to be approved by an NGO first. Go to "My NGOs" tab to apply.')
      return
    }

    setActionLoading(taskId)
    try {
      await volunteerApi.applyToTask(taskId)
      setAppliedTaskIds(prev => [...prev, taskId])
      showSuccess('✅ Application submitted! Awaiting committee approval.')
      await fetchVolunteerData()
      await fetchAppliedTaskIds()
    } catch (err) {
      const msg = err.message || 'Failed to apply'
      if (msg.toLowerCase().includes('already')) {
        setAppliedTaskIds(prev => [...prev, taskId])
        showSuccess('ℹ️ Already applied to this task.')
      } else {
        alert('❌ ' + msg)
      }
    } finally {
      setActionLoading(null)
    }
  }

  const handleCompleteTask = async () => {
    if (!myCurrentTask) return
    setActionLoading('complete')
    try {
      const response = await volunteerApi.completeTask(myCurrentTask._id, {
        rating: 5,
        feedback: 'Great task!'
      })
      if (response.success) {
        showSuccess('🎉 Task completed successfully!')
        await fetchVolunteerData()
      }
    } catch (err) {
      alert('❌ ' + err.message)
    } finally {
      setActionLoading(null)
    }
  }

  // ═══════════════════════════════════════
  // FILTERED TASKS
  // ═══════════════════════════════════════

  const getFilteredAndSortedTasks = useCallback(() => {
    let filtered = [...tasks]

    if (taskSearch.trim()) {
      const q = taskSearch.toLowerCase()
      filtered = filtered.filter(t =>
        t.title?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.locationName?.toLowerCase().includes(q) ||
        t.category?.toLowerCase().includes(q)
      )
    }

    if (taskCategoryFilter) {
      filtered = filtered.filter(t => t.category === taskCategoryFilter)
    }

    if (taskSort === 'urgent') {
      filtered.sort((a, b) => b.urgencyScore - a.urgencyScore)
    } else if (taskSort === 'nearest') {
      filtered.sort((a, b) => (a.distance || 999) - (b.distance || 999))
    } else if (taskSort === 'duration') {
      filtered.sort((a, b) => a.duration - b.duration)
    } else if (taskSort === 'skills') {
      filtered.sort((a, b) => getSkillMatch(b.skillsRequired) - getSkillMatch(a.skillsRequired))
    }

    return filtered
  }, [tasks, taskSearch, taskSort, taskCategoryFilter, profileData.skills])

  // ═══════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════

  const getSkillMatch = (taskSkills) => {
    if (!profileData.skills?.length || !taskSkills?.length) return 0
    const matches = taskSkills.filter(s => profileData.skills.includes(s)).length
    return Math.round((matches / taskSkills.length) * 100)
  }

  const getStatusColor = (status) => {
    if (status === 'FREE') return { bg: 'bg-green-100', text: 'text-green-700', icon: '🟢', border: 'border-green-500' }
    if (status === 'BUSY') return { bg: 'bg-red-100', text: 'text-red-700', icon: '🔴', border: 'border-red-500' }
    return { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: '⏳', border: 'border-yellow-500' }
  }

  const getAssignmentStatusColor = (status) => {
    if (status === 'approved') return { bg: 'bg-green-100', text: 'text-green-700', label: '✅ Approved' }
    if (status === 'assignment_sent') return { bg: 'bg-blue-100', text: 'text-blue-700', label: '📧 Invited' }
    if (status === 'pending_assignment') return { bg: 'bg-gray-100', text: 'text-gray-600', label: '⏳ Pending' }
    return { bg: 'bg-gray-100', text: 'text-gray-600', label: status }
  }

  const filteredTasks = getFilteredAndSortedTasks()
  const statusColor = getStatusColor(availabilityStatus)
  const categories = [...new Set(tasks.map(t => t.category).filter(Boolean))]
  const approvedNgoCount = myNgos.filter(n => n.status === 'approved').length
  const pendingNgoCount = myNgos.filter(n => n.status === 'pending').length

  const tabs = [
    { key: 'overview', label: 'Overview', icon: '📊' },
    { key: 'ngos', label: 'My NGOs', icon: '🏢', badge: pendingNgoCount },
    { key: 'available', label: 'Tasks', icon: '🎯', badge: tasks.filter(t => !appliedTaskIds.includes(t._id)).length },
    { key: 'pending', label: 'Pending', icon: '⏳', badge: pendingTasks.length },
    { key: 'assignments', label: 'Assignments', icon: '📋', badge: myAssignments.length },
    { key: 'active', label: 'Active', icon: '🔥', badge: myCurrentTask ? 1 : 0 },
    { key: 'history', label: 'History', icon: '📜', badge: taskHistory.length },
    { key: 'profile', label: 'Profile', icon: '👤' },
    { key: 'map', label: 'Map', icon: '🗺️' }
  ]

  // ═══════════════════════════════════════
  // LOADING
  // ═══════════════════════════════════════

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">

      {/* ── Navbar ── */}
      <nav className="bg-white shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-2xl shadow-lg">
                🙋
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-800">Volunteer Dashboard</h1>
                <p className="text-xs text-gray-500 hidden sm:block">
                  📍 {currentLocation.locationName || 'Location not set'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium text-xs border ${statusColor.bg} ${statusColor.text} ${statusColor.border}`}>
                <span>{statusColor.icon}</span>
                <span className="hidden sm:inline">{availabilityStatus}</span>
              </div>
              <span className="hidden md:inline text-sm text-gray-700 font-medium">
                {user?.fullName?.split(' ')[0]}
              </span>
              <button
                onClick={() => { logout(); navigate('/login') }}
                className="px-3 py-2 bg-red-600 text-white rounded-lg font-medium text-xs"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Alerts ── */}
      {successMsg && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-3 mx-4 mt-3 rounded text-sm">
          {successMsg}
        </div>
      )}
      {error && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-3 mx-4 mt-3 rounded text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="bg-white border-b border-gray-200 sticky top-14 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-2 sm:px-6">
          <div className="flex gap-0.5 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key)
                  if (tab.key !== 'map' && map.current) {
                    map.current.remove()
                    map.current = null
                  }
                }}
                className={`px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium whitespace-nowrap flex items-center gap-1.5 border-b-2 transition-all ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <span>{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.badge > 0 && (
                  <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">

        {/* ══════════════════════════════════════
            OVERVIEW TAB
        ══════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div className="space-y-5">

            {/* Status Card */}
            <div className={`rounded-2xl p-4 border-2 ${statusColor.border} ${statusColor.bg}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-xs font-semibold ${statusColor.text} uppercase tracking-wide`}>
                    Current Status
                  </p>
                  <p className={`text-2xl font-bold ${statusColor.text} mt-1`}>
                    {statusColor.icon} {availabilityStatus}
                  </p>
                  {availabilityStatus === 'BUSY' && myCurrentTask && (
                    <p className={`text-xs ${statusColor.text} mt-1`}>
                      Working on: {myCurrentTask.title}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  {availabilityStatus === 'FREE' ? (
                    <p className="text-xs text-green-600 font-medium">Ready for tasks!</p>
                  ) : (
                    <button
                      onClick={() => setActiveTab('active')}
                      className="text-xs bg-white px-3 py-1.5 rounded-lg font-medium text-gray-700 border hover:bg-gray-50"
                    >
                      View Task →
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* NGO Status Banner */}
            {approvedNgoCount === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div className="flex-1">
                  <p className="font-semibold text-yellow-800 text-sm">No Approved NGOs</p>
                  <p className="text-xs text-yellow-700 mt-1">
                    You need to apply to and be approved by an NGO to see available tasks.
                  </p>
                  <button
                    onClick={() => setActiveTab('ngos')}
                    className="mt-2 text-xs bg-yellow-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-yellow-700"
                  >
                    Apply to NGO →
                  </button>
                </div>
              </div>
            )}

            {approvedNgoCount > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="font-semibold text-green-800 text-sm">
                    Approved by {approvedNgoCount} NGO{approvedNgoCount > 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-green-600 mt-0.5">
                    Tasks from your approved NGOs are visible in the Tasks tab
                  </p>
                </div>
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  label: 'Available Tasks',
                  value: tasks.filter(t => !appliedTaskIds.includes(t._id)).length,
                  icon: '🎯',
                  color: 'from-blue-500 to-blue-600',
                  tab: 'available'
                },
                {
                  label: 'Pending',
                  value: pendingTasks.length,
                  icon: '⏳',
                  color: 'from-yellow-500 to-yellow-600',
                  tab: 'pending'
                },
                {
                  label: 'Completed',
                  value: taskHistory.length,
                  icon: '✅',
                  color: 'from-green-500 to-green-600',
                  tab: 'history'
                },
                {
                  label: 'Assignments',
                  value: myAssignments.length,
                  icon: '📋',
                  color: 'from-purple-500 to-purple-600',
                  tab: 'assignments'
                }
              ].map((card, i) => (
                <button
                  key={i}
                  onClick={() => setActiveTab(card.tab)}
                  className={`bg-gradient-to-br ${card.color} rounded-2xl p-4 text-white shadow-lg hover:opacity-90 transition text-left`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs opacity-90 font-medium">{card.label}</p>
                    <span className="text-2xl opacity-80">{card.icon}</span>
                  </div>
                  <p className="text-3xl font-bold">{card.value}</p>
                </button>
              ))}
            </div>

            {/* Location Card */}
            <div className="bg-white rounded-2xl p-5 shadow-md border">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-gray-800">📍 Your Location</h3>
                <button
                  onClick={() => { setIsEditingLocation(true); setActiveTab('profile') }}
                  className="text-blue-600 text-sm font-medium hover:underline"
                >
                  Update →
                </button>
              </div>
              <p className="text-sm text-gray-600">
                {currentLocation.locationName || 'Location not set. Update your location to see nearby tasks.'}
              </p>
            </div>

            {/* Skills */}
            {profileData.skills.length > 0 && (
              <div className="bg-white rounded-2xl p-5 shadow-md border">
                <h3 className="font-bold text-gray-800 mb-3">🎯 Your Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {profileData.skills.map(skill => (
                    <span key={skill} className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-xs font-medium">
                      ✓ {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white shadow-lg">
                <h3 className="text-lg font-bold mb-1">🏢 My NGOs</h3>
                <p className="text-3xl font-bold mb-3">{approvedNgoCount} Approved</p>
                <button
                  onClick={() => setActiveTab('ngos')}
                  className="w-full bg-white text-blue-600 font-bold py-2.5 rounded-xl hover:bg-blue-50 text-sm"
                >
                  Manage NGOs →
                </button>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-5 text-white shadow-lg">
                <h3 className="text-lg font-bold mb-1">✅ Completed</h3>
                <p className="text-3xl font-bold mb-3">{taskHistory.length}</p>
                <button
                  onClick={() => setActiveTab('history')}
                  className="w-full bg-white text-green-600 font-bold py-2.5 rounded-xl hover:bg-green-50 text-sm"
                >
                  View History →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            NGO TAB
        ══════════════════════════════════════ */}
        {activeTab === 'ngos' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800">🏢 NGO Applications</h2>
              <p className="text-sm text-gray-500 mt-1">
                Apply to NGOs to access their tasks and volunteer opportunities
              </p>
            </div>

            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <p className="text-sm text-blue-800 font-semibold mb-2">💡 How it works:</p>
              <div className="space-y-1.5">
                {[
                  '1️⃣ Apply to an NGO below',
                  '2️⃣ Wait for committee approval',
                  '3️⃣ Once approved, tasks from that NGO appear in your Tasks tab',
                ].map((step, i) => (
                  <p key={i} className="text-xs text-blue-700">{step}</p>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { val: myNgos.length, label: 'Total Applied', color: 'text-blue-600', bg: 'bg-blue-50' },
                { val: pendingNgoCount, label: 'Pending', color: 'text-yellow-600', bg: 'bg-yellow-50' },
                { val: approvedNgoCount, label: 'Approved', color: 'text-green-600', bg: 'bg-green-50' },
              ].map((s, i) => (
                <div key={i} className={`${s.bg} rounded-2xl p-4 text-center border`}>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
                  <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {/* My Applications */}
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <div className="px-5 py-4 border-b bg-purple-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-purple-800">📋 My Applications</h3>
                  <span className="bg-purple-200 text-purple-800 text-xs px-2 py-0.5 rounded-full font-bold">
                    {myNgos.length}
                  </span>
                </div>
                <button onClick={fetchMyNgos} className="text-xs text-purple-600 hover:underline">🔄</button>
              </div>

              {myNgos.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-3xl mb-2">📬</p>
                  <p className="text-gray-500 text-sm">No applications yet.</p>
                  <p className="text-gray-400 text-xs mt-1">Apply to an NGO below to get started!</p>
                </div>
              ) : (
                <div className="divide-y">
                  {myNgos.map(app => {
                    const status = app.status
                    return (
                      <div
                        key={app._id}
                        className={`p-4 flex items-center justify-between hover:bg-gray-50 border-l-4 ${
                          status === 'approved' ? 'border-green-500' :
                          status === 'pending' ? 'border-yellow-500' : 'border-red-500'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                            status === 'approved' ? 'bg-green-100' :
                            status === 'pending' ? 'bg-yellow-100' : 'bg-red-100'
                          }`}>
                            {status === 'approved' ? '✅' : status === 'pending' ? '⏳' : '❌'}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800 text-sm">
                              {app.ngoId?.name || 'Unknown NGO'}
                            </p>
                            {app.ngoId?.locationName && (
                              <p className="text-xs text-gray-400">📍 {app.ngoId.locationName}</p>
                            )}
                            <p className="text-xs text-gray-400">
                              Applied: {new Date(app.createdAt || app.appliedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs px-3 py-1.5 rounded-full font-bold ${
                            status === 'approved' ? 'bg-green-100 text-green-700' :
                            status === 'pending' ? 'bg-yellow-100 text-yellow-700 animate-pulse' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {status === 'approved' ? '✅ Approved' :
                             status === 'pending' ? '⏳ Pending' : '❌ Rejected'}
                          </span>
                          {status === 'approved' && (
                            <p className="text-xs text-green-600 mt-1">Tasks visible ✓</p>
                          )}
                          {status === 'pending' && (
                            <p className="text-xs text-yellow-600 mt-1">Awaiting approval</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Discover NGOs */}
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <div className="px-5 py-4 border-b bg-blue-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-blue-800">🔍 Discover NGOs</h3>
                  <span className="bg-blue-200 text-blue-800 text-xs px-2 py-0.5 rounded-full font-bold">
                    {allNgos.length}
                  </span>
                </div>
                <button onClick={fetchAllNgos} className="text-xs text-blue-600 hover:underline">🔄</button>
              </div>

              {loadingNgos ? (
                <div className="p-8 text-center">
                  <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
                  <p className="text-sm text-gray-500 mt-2">Loading NGOs...</p>
                </div>
              ) : allNgos.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  No NGOs found
                </div>
              ) : (
                <div className="divide-y">
                  {allNgos.map(ngo => {
                    const myApp = myNgos.find(
                      a => (a.ngoId?._id || a.ngoId)?.toString() === ngo._id?.toString()
                    )
                    const appStatus = myApp?.status

                    return (
                      <div key={ngo._id} className="p-4 flex items-center justify-between hover:bg-gray-50">
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
                          </div>
                        </div>
                        <div className="flex-shrink-0 ml-3">
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
                              onClick={() => setShowNgoApplyModal(ngo)}
                              className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-full font-bold border border-red-200 hover:bg-red-100"
                            >
                              🔄 Reapply
                            </button>
                          ) : (
                            <button
                              onClick={() => setShowNgoApplyModal(ngo)}
                              className="px-4 py-2 bg-blue-600 text-white text-xs rounded-xl font-medium hover:bg-blue-700 transition"
                            >
                              📩 Apply
                            </button>
                          )}
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
            AVAILABLE TASKS TAB
        ══════════════════════════════════════ */}
        {activeTab === 'available' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Available Tasks</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {tasks.filter(t => !appliedTaskIds.includes(t._id)).length} tasks you haven't applied to
                </p>
              </div>
            </div>

            {/* No approved NGO warning */}
            {approvedNgoCount === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5 text-center">
                <p className="text-3xl mb-2">🏢</p>
                <h3 className="font-bold text-yellow-800 text-base">No Approved NGOs</h3>
                <p className="text-sm text-yellow-700 mt-2">
                  You need to be approved by an NGO to see and apply to their tasks.
                </p>
                <button
                  onClick={() => setActiveTab('ngos')}
                  className="mt-3 px-5 py-2 bg-yellow-600 text-white rounded-xl text-sm font-bold hover:bg-yellow-700"
                >
                  Apply to NGO →
                </button>
              </div>
            )}

            {/* Busy Warning */}
            {availabilityStatus !== 'FREE' && (
              <div className="bg-orange-50 border border-orange-200 text-orange-700 p-4 rounded-xl flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="font-bold">You are currently {availabilityStatus}</p>
                  <p className="text-sm mt-1">Complete your active task before applying to new ones.</p>
                  <button
                    onClick={() => setActiveTab('active')}
                    className="mt-2 text-xs underline font-medium"
                  >
                    View Active Task →
                  </button>
                </div>
              </div>
            )}

            {/* Filters */}
            {approvedNgoCount > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border space-y-3">
                <div className="flex flex-wrap gap-3">
                  <div className="flex-1 min-w-[200px] relative">
                    <input
                      type="text"
                      value={taskSearch}
                      onChange={e => setTaskSearch(e.target.value)}
                      placeholder="Search tasks..."
                      className="w-full px-4 py-2 pl-9 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="absolute left-3 top-2.5 text-gray-400 text-sm">🔍</span>
                  </div>
                  <select
                    value={taskCategoryFilter}
                    onChange={e => setTaskCategoryFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="">All Categories</option>
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <select
                    value={taskSort}
                    onChange={e => setTaskSort(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="">Sort By...</option>
                    <option value="urgent">🔥 Most Urgent</option>
                    <option value="nearest">📍 Nearest</option>
                    <option value="duration">⏱️ Short Duration</option>
                    <option value="skills">✨ Best Match</option>
                  </select>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{filteredTasks.length} tasks found</span>
                  {(taskSearch || taskCategoryFilter || taskSort) && (
                    <button
                      onClick={() => { setTaskSearch(''); setTaskCategoryFilter(''); setTaskSort('') }}
                      className="text-blue-600 hover:underline"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Tasks */}
            {approvedNgoCount > 0 && filteredTasks.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-md border">
                <p className="text-5xl mb-3">🔍</p>
                <h3 className="text-lg font-bold text-gray-800">No tasks found</h3>
                <p className="text-sm text-gray-500 mt-2">
                  {taskSearch || taskCategoryFilter
                    ? 'Try different search terms'
                    : availabilityStatus !== 'FREE'
                    ? 'Complete your current task first'
                    : 'Check back later for new tasks'}
                </p>
                {(taskSearch || taskCategoryFilter) && (
                  <button
                    onClick={() => { setTaskSearch(''); setTaskCategoryFilter('') }}
                    className="mt-4 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            ) : approvedNgoCount > 0 ? (
              <div className="space-y-4">
                {filteredTasks.map(task => {
                  const skillMatch = getSkillMatch(task.skillsRequired)
                  const isApplied = appliedTaskIds.includes(task._id)
                  const isApplying = actionLoading === task._id
                  const filledSlots = task.assignedVolunteers?.filter(
                    v => v.status === 'accepted' || v.status === 'approved'
                  ).length || 0
                  const isFull = filledSlots >= task.volunteersNeeded

                  return (
                    <div
                      key={task._id}
                      className={`bg-white rounded-2xl p-5 shadow-md hover:shadow-lg transition border-l-4 ${
                        isApplied ? 'border-green-500 opacity-90' :
                        isFull ? 'border-red-400 opacity-75' : 'border-blue-500'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row items-start gap-4">
                        <div className="flex-1 w-full">
                          <div className="flex items-start gap-3 mb-3">
                            <span className="text-3xl flex-shrink-0">{getTaskIcon(task.category)}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 flex-wrap">
                                <div>
                                  <h4 className="text-base font-bold text-gray-800">{task.title}</h4>
                                  <p className="text-xs text-gray-500 mt-0.5">🏢 {task.ngo?.name || 'Unknown NGO'}</p>
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                  {isApplied && (
                                    <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-full text-xs font-bold">
                                      ✅ Applied
                                    </span>
                                  )}
                                  {isFull && !isApplied && (
                                    <span className="bg-red-100 text-red-700 px-2.5 py-1 rounded-full text-xs font-bold">
                                      ❌ Full
                                    </span>
                                  )}
                                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                    task.urgencyScore >= 75 ? 'bg-red-100 text-red-700' :
                                    task.urgencyScore >= 50 ? 'bg-orange-100 text-orange-700' :
                                    'bg-green-100 text-green-700'
                                  }`}>
                                    ⚡ {task.urgencyScore}
                                  </span>
                                  {skillMatch > 0 && (
                                    <span className="bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full text-xs font-bold">
                                      🎯 {skillMatch}% match
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {task.description && (
                            <p className="text-sm text-gray-600 mb-4 line-clamp-2">{task.description}</p>
                          )}

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-xs">
                            <div className="bg-gray-50 rounded-lg p-2 text-center">
                              <p className="text-gray-500">Duration</p>
                              <p className="font-bold text-gray-800 mt-0.5">{task.duration} days</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-2 text-center">
                              <p className="text-gray-500">Distance</p>
                              <p className="font-bold text-gray-800 mt-0.5">{task.distance || '?'}km</p>
                            </div>
                            <div className={`rounded-lg p-2 text-center ${isFull ? 'bg-red-50' : 'bg-blue-50'}`}>
                              <p className={isFull ? 'text-red-500' : 'text-blue-500'}>Slots</p>
                              <p className={`font-bold mt-0.5 ${isFull ? 'text-red-700' : 'text-blue-700'}`}>
                                {filledSlots}/{task.volunteersNeeded}
                              </p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-2 text-center">
                              <p className="text-gray-500">Starts</p>
                              <p className="font-bold text-gray-800 mt-0.5 text-[10px]">
                                {new Date(task.startDate).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          <div className="mb-3">
                            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                              <span>Volunteer slots</span>
                              <span>{filledSlots}/{task.volunteersNeeded} filled</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full transition-all ${isFull ? 'bg-red-500' : 'bg-blue-500'}`}
                                style={{ width: `${Math.min((filledSlots / task.volunteersNeeded) * 100, 100)}%` }}
                              />
                            </div>
                          </div>

                          {task.skillsRequired?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {task.skillsRequired.map(skill => (
                                <span
                                  key={skill}
                                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                    profileData.skills?.includes(skill)
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-gray-100 text-gray-600'
                                  }`}
                                >
                                  {profileData.skills?.includes(skill) ? '✓' : '○'} {skill}
                                </span>
                              ))}
                            </div>
                          )}

                          <p className="text-xs text-gray-400">📍 {task.locationName}</p>
                        </div>

                        <div className="w-full lg:w-auto flex-shrink-0">
                          {isApplied ? (
                            <div className="w-full lg:w-36 px-4 py-3 bg-green-50 border border-green-200 text-green-700 font-bold rounded-xl text-sm text-center">
                              ✅ Applied
                            </div>
                          ) : isFull ? (
                            <div className="w-full lg:w-36 px-4 py-3 bg-red-50 border border-red-200 text-red-600 font-bold rounded-xl text-sm text-center">
                              ❌ Full
                            </div>
                          ) : (
                            <button
                              onClick={() => handleApplyTask(task._id)}
                              disabled={isApplying || availabilityStatus !== 'FREE'}
                              className="w-full lg:w-36 px-4 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                            >
                              {isApplying ? (
                                <>
                                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                  Applying...
                                </>
                              ) : availabilityStatus !== 'FREE' ? (
                                '🔒 Busy'
                              ) : (
                                '📩 Apply'
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : null}
          </div>
        )}

        {/* ══════════════════════════════════════
            PENDING TAB
        ══════════════════════════════════════ */}
        {activeTab === 'pending' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Pending Applications</h2>
              <p className="text-sm text-gray-500 mt-1">
                Tasks you've applied to — waiting for committee approval
              </p>
            </div>

            {pendingTasks.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-md border">
                <p className="text-5xl mb-3">📬</p>
                <h3 className="text-lg font-bold text-gray-800">No Pending Applications</h3>
                <p className="text-sm text-gray-500 mt-2">Apply to tasks to see them here.</p>
                <button
                  onClick={() => setActiveTab('available')}
                  className="mt-4 bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-700"
                >
                  Browse Tasks
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingTasks.map(task => (
                  <div key={task._id} className="bg-white rounded-2xl p-5 shadow-md border-l-4 border-yellow-500">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl flex-shrink-0">{getTaskIcon(task.category)}</span>
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <h4 className="font-bold text-gray-800">{task.title}</h4>
                            <p className="text-xs text-gray-500 mt-0.5">🏢 {task.ngo?.name || 'Unknown NGO'}</p>
                          </div>
                          <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                            ⏳ Awaiting Approval
                          </span>
                        </div>
                        {task.description && (
                          <p className="text-sm text-gray-600 mt-2 line-clamp-2">{task.description}</p>
                        )}
                        <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-500">
                          <span>📍 {task.locationName || 'N/A'}</span>
                          <span>⏱️ {task.duration} days</span>
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

        {/* ══════════════════════════════════════
            ASSIGNMENTS TAB
        ══════════════════════════════════════ */}
        {activeTab === 'assignments' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800">My Assignments</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Tasks assigned to you by committee members
                </p>
              </div>
              <button
                onClick={fetchMyAssignments}
                className="text-xs text-blue-600 hover:underline"
              >
                🔄 Refresh
              </button>
            </div>

            {loadingAssignments ? (
              <div className="text-center py-12">
                <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Loading assignments...</p>
              </div>
            ) : myAssignments.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-md border">
                <p className="text-5xl mb-3">📋</p>
                <h3 className="text-lg font-bold text-gray-800">No Assignments Yet</h3>
                <p className="text-sm text-gray-500 mt-2">
                  When a committee member assigns you to a task, it will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {myAssignments.map(assignment => {
                  const mySlots = assignment.slots || []

                  return (
                    <div
                      key={assignment._id}
                      className={`bg-white rounded-2xl p-5 shadow-md border-l-4 ${
                        assignment.assignmentStatus === 'active' ? 'border-green-500' :
                        assignment.assignmentStatus === 'pending' ? 'border-blue-500' :
                        'border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <h4 className="font-bold text-gray-800">
                            {assignment.task?.title || 'Task Assignment'}
                          </h4>
                          <p className="text-xs text-gray-500 mt-0.5">
                            🏢 {assignment.ngo?.name || 'Unknown NGO'}
                          </p>
                        </div>
                        <span className={`text-xs px-3 py-1 rounded-full font-bold ${
                          assignment.assignmentStatus === 'active' ? 'bg-green-100 text-green-700' :
                          assignment.assignmentStatus === 'pending' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {assignment.assignmentStatus === 'active' ? '✅ Active' :
                           assignment.assignmentStatus === 'pending' ? '📧 Pending' :
                           assignment.assignmentStatus}
                        </span>
                      </div>

                      {assignment.task?.description && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                          {assignment.task.description}
                        </p>
                      )}

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3 text-xs">
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-gray-500">⏱️ Duration</p>
                          <p className="font-bold text-gray-800">{assignment.durationDays} days</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-gray-500">📅 Start</p>
                          <p className="font-bold text-gray-800">
                            {assignment.startDate
                              ? new Date(assignment.startDate).toLocaleDateString()
                              : 'TBD'}
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-gray-500">👥 Progress</p>
                          <p className="font-bold text-gray-800">{assignment.progress || '0/0'}</p>
                        </div>
                      </div>

                      {mySlots.length > 0 && (
                        <div className="space-y-2">
                          {mySlots.map((slot, idx) => {
                            const sc = getAssignmentStatusColor(slot.status)
                            return (
                              <div
                                key={idx}
                                className={`flex items-center justify-between p-3 rounded-xl border ${sc.bg}`}
                              >
                                <div>
                                  <p className={`text-xs font-bold ${sc.text}`}>
                                    Slot {slot.slotNumber} — {sc.label}
                                  </p>
                                  {slot.assignmentEmailSentAt && (
                                    <p className="text-xs text-gray-400 mt-0.5">
                                      Email sent: {new Date(slot.assignmentEmailSentAt).toLocaleDateString()}
                                    </p>
                                  )}
                                  {slot.approvalResponseAt && (
                                    <p className="text-xs text-gray-400 mt-0.5">
                                      Responded: {new Date(slot.approvalResponseAt).toLocaleDateString()}
                                    </p>
                                  )}
                                </div>
                                {slot.status === 'assignment_sent' && (
                                  <p className="text-xs text-blue-600 font-medium">
                                    Check your email to respond
                                  </p>
                                )}
                                {slot.status === 'approved' && (
                                  <span className="text-green-600 text-lg">✅</span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-400">
                          Created: {new Date(assignment.createdAt).toLocaleDateString()}
                        </p>
                        {assignment.assignmentStatus === 'active' && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                            🎉 All slots filled — Task Active!
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════
            ACTIVE TASK TAB
        ══════════════════════════════════════ */}
        {activeTab === 'active' && (
          <div>
            {!myCurrentTask ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-md border">
                <p className="text-5xl mb-3">⏳</p>
                <h3 className="text-lg font-bold text-gray-800 mb-2">No Active Task</h3>
                <p className="text-sm text-gray-500 mb-6">You're not assigned to any task right now.</p>
                <button
                  onClick={() => setActiveTab('available')}
                  className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 text-sm"
                >
                  Browse Tasks
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden border">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 text-white">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-blue-100 text-sm font-medium mb-1">🔥 Currently Active</p>
                      <h3 className="text-xl font-bold">{myCurrentTask.title}</h3>
                      <p className="text-blue-100 text-sm mt-1">
                        🏢 {myCurrentTask.ngo?.name || 'Unknown NGO'}
                      </p>
                    </div>
                    <span className="text-4xl">{getTaskIcon(myCurrentTask.category)}</span>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  {myCurrentTask.description && (
                    <p className="text-sm text-gray-700">{myCurrentTask.description}</p>
                  )}

                  <div className="grid grid-cols-3 gap-3 text-center text-xs">
                    <div className="bg-blue-50 rounded-xl p-3">
                      <p className="text-gray-500">Duration</p>
                      <p className="text-xl font-bold text-blue-600 mt-1">{myCurrentTask.duration}d</p>
                    </div>
                    <div className="bg-green-50 rounded-xl p-3">
                      <p className="text-gray-500">Ends</p>
                      <p className="text-base font-bold text-green-600 mt-1">
                        {new Date(myCurrentTask.endDate).toLocaleDateString('en', {
                          month: 'short', day: 'numeric'
                        })}
                      </p>
                    </div>
                    <div className="bg-purple-50 rounded-xl p-3">
                      <p className="text-gray-500">Location</p>
                      <p className="text-xs font-bold text-purple-600 mt-1">
                        {myCurrentTask.locationName?.split(',')[0] || 'Unknown'}
                      </p>
                    </div>
                  </div>

                  {myCurrentTask.skillsRequired?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-2">Required Skills</p>
                      <div className="flex flex-wrap gap-1.5">
                        {myCurrentTask.skillsRequired.map(skill => (
                          <span key={skill} className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleCompleteTask}
                    disabled={actionLoading === 'complete'}
                    className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 disabled:opacity-50 text-sm"
                  >
                    {actionLoading === 'complete' ? '⏳ Completing...' : '✅ Mark as Complete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════
            HISTORY TAB
        ══════════════════════════════════════ */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Task History</h2>
                <p className="text-sm text-gray-500 mt-0.5">{taskHistory.length} completed tasks</p>
              </div>
            </div>

            {taskHistory.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-md border">
                <p className="text-5xl mb-3">📜</p>
                <h3 className="text-lg font-bold text-gray-800">No History Yet</h3>
                <p className="text-sm text-gray-500 mt-2">Complete tasks to build your history.</p>
                <button
                  onClick={() => setActiveTab('available')}
                  className="mt-4 bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm"
                >
                  Browse Tasks
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {taskHistory.map(task => (
                  <div
                    key={task._id}
                    className="bg-white rounded-2xl p-5 shadow-md border-l-4 border-green-500 hover:shadow-lg transition"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl flex-shrink-0">{getTaskIcon(task.category)}</span>
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <h4 className="font-bold text-gray-800">{task.title}</h4>
                            <p className="text-xs text-gray-500 mt-0.5">🏢 {task.ngo?.name || 'Unknown NGO'}</p>
                          </div>
                          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">
                            ✅ Completed
                          </span>
                        </div>

                        {task.description && (
                          <p className="text-sm text-gray-600 mt-2 line-clamp-2">{task.description}</p>
                        )}

                        <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-500">
                          <span>📍 {task.locationName || 'N/A'}</span>
                          <span>⏱️ {task.duration} days</span>
                          {task.completedAt && (
                            <span>📅 {new Date(task.completedAt).toLocaleDateString()}</span>
                          )}
                        </div>

                        {(task.rating > 0 || task.feedback) && (
                          <div className="flex items-center gap-3 mt-3">
                            {task.rating > 0 && (
                              <div className="flex gap-0.5">
                                {[...Array(5)].map((_, i) => (
                                  <span
                                    key={i}
                                    className={i < Math.floor(task.rating || 0) ? 'text-yellow-400' : 'text-gray-200'}
                                  >
                                    ⭐
                                  </span>
                                ))}
                              </div>
                            )}
                            {task.feedback && (
                              <span className="text-xs text-gray-600 italic">"{task.feedback}"</span>
                            )}
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

        {/* ══════════════════════════════════════
            PROFILE TAB
        ══════════════════════════════════════ */}
        {activeTab === 'profile' && (
          <div className="space-y-5">

            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl p-6 text-white">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-4xl shadow-lg">
                  👤
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h2 className="text-2xl font-bold">{user?.fullName}</h2>
                  <p className="text-blue-100 text-sm mt-1">{user?.email}</p>
                  <p className="text-blue-200 text-xs mt-1">
                    📍 {currentLocation.locationName || 'Location not set'}
                  </p>
                  {profileData.rating > 0 && (
                    <p className="text-blue-100 text-xs mt-1">
                      ⭐ {profileData.rating.toFixed(1)}/5 Rating
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setIsEditingProfile(!isEditingProfile)
                      setIsEditingLocation(false)
                    }}
                    className="bg-white text-blue-600 px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-50"
                  >
                    {isEditingProfile ? '✕ Cancel' : '✏️ Edit'}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingLocation(!isEditingLocation)
                      setIsEditingProfile(false)
                    }}
                    className="bg-blue-400 bg-opacity-50 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-opacity-70"
                  >
                    {isEditingLocation ? '✕ Cancel' : '📍 Location'}
                  </button>
                </div>
              </div>
            </div>

            {/* Location Editor */}
            {isEditingLocation && (
              <div className="bg-white rounded-2xl p-5 shadow-md border space-y-4">
                <h3 className="text-lg font-bold text-gray-800">📍 Update Location</h3>

                <button
                  onClick={handleGetLiveLocation}
                  disabled={locationLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 disabled:opacity-50 text-sm"
                >
                  {locationLoading ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      Getting Location...
                    </>
                  ) : '📡 Use My Live Location'}
                </button>

                <div className="relative">
                  <input
                    type="text"
                    value={locationSearch}
                    onChange={e => handleLocationSearch(e.target.value)}
                    placeholder="Search for a location..."
                    className="w-full px-4 py-3 border rounded-xl text-sm pl-9 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="absolute left-3 top-3 text-gray-400 text-sm">🔍</span>

                  {locationSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border rounded-xl mt-1 shadow-lg z-50 max-h-60 overflow-y-auto">
                      {locationSuggestions.map(feature => (
                        <button
                          key={feature.id}
                          onClick={() => handleSelectLocation(feature)}
                          className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-100 text-sm last:border-b-0"
                        >
                          <p className="font-medium text-gray-800">{feature.text}</p>
                          <p className="text-xs text-gray-500">{feature.place_name}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-xs text-blue-600 font-bold mb-1">Selected Location:</p>
                  <p className="text-sm text-gray-800">{currentLocation.locationName || 'None'}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Coordinates: {currentLocation.coordinates[1]?.toFixed(4)}, {currentLocation.coordinates[0]?.toFixed(4)}
                  </p>
                </div>

                <div ref={locationMapContainer} className="w-full h-72 rounded-xl overflow-hidden border" />
                <p className="text-xs text-gray-400 text-center">Click on map or drag marker to set location</p>

                <button
                  onClick={handleSaveLocation}
                  disabled={actionLoading === 'location'}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 text-sm"
                >
                  {actionLoading === 'location' ? '⏳ Saving...' : '✓ Save Location'}
                </button>
              </div>
            )}

            {/* Profile Editor */}
            {isEditingProfile && !isEditingLocation && (
              <form onSubmit={handleProfileUpdate} className="bg-white rounded-2xl p-5 shadow-md border space-y-4">
                <h3 className="text-lg font-bold text-gray-800">Edit Profile</h3>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                    <input
                      type="text"
                      value={profileData.fullName}
                      onChange={e => setProfileData(prev => ({ ...prev, fullName: e.target.value }))}
                      className="w-full px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={profileData.phoneNumber}
                      onChange={e => setProfileData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                      className="w-full px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                  <textarea
                    value={profileData.bio}
                    onChange={e => setProfileData(prev => ({ ...prev, bio: e.target.value }))}
                    rows={3}
                    className="w-full px-4 py-2 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Tell us about yourself..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Distance (km): {profileData.maxDistance}km
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="200"
                    value={profileData.maxDistance}
                    onChange={e => setProfileData(prev => ({ ...prev, maxDistance: parseInt(e.target.value) }))}
                    className="w-full accent-blue-600"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>5km</span>
                    <span>200km</span>
                  </div>
                </div>

                {/* Skills */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Skills</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newSkill}
                      onChange={e => setNewSkill(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
                      className="flex-1 px-4 py-2 border rounded-lg text-sm"
                      placeholder="Add skill..."
                    />
                    <button
                      type="button"
                      onClick={handleAddSkill}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {profileData.skills.map(skill => (
                      <span key={skill} className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5">
                        {skill}
                        <button type="button" onClick={() => handleRemoveSkill(skill)} className="hover:text-red-600 font-bold">×</button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Interests */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Interests</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newInterest}
                      onChange={e => setNewInterest(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddInterest())}
                      className="flex-1 px-4 py-2 border rounded-lg text-sm"
                      placeholder="Add interest..."
                    />
                    <button
                      type="button"
                      onClick={handleAddInterest}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {profileData.interests.map(interest => (
                      <span key={interest} className="bg-purple-100 text-purple-700 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5">
                        {interest}
                        <button type="button" onClick={() => handleRemoveInterest(interest)} className="hover:text-red-600 font-bold">×</button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading === 'profile'}
                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-bold disabled:opacity-50 text-sm"
                  >
                    {actionLoading === 'profile' ? '⏳ Saving...' : '✓ Save Profile'}
                  </button>
                </div>
              </form>
            )}

            {/* Profile View */}
            {!isEditingProfile && !isEditingLocation && (
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="bg-white rounded-2xl p-5 shadow-md border">
                    <h4 className="text-sm font-semibold text-gray-600 mb-3">📞 Contact Info</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 w-20 text-xs">Email</span>
                        <span className="text-gray-700 font-medium truncate">{user?.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 w-20 text-xs">Phone</span>
                        <span className="text-gray-700 font-medium">{profileData.phoneNumber || 'Not set'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 w-20 text-xs">Location</span>
                        <span className="text-gray-700 font-medium text-xs">{currentLocation.locationName || 'Not set'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 w-20 text-xs">Distance</span>
                        <span className="text-gray-700 font-medium">{profileData.maxDistance}km max</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl p-5 shadow-md border">
                    <h4 className="text-sm font-semibold text-gray-600 mb-3">📊 Stats</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Completed</span>
                        <span className="font-bold text-green-600">{taskHistory.length} tasks</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Pending</span>
                        <span className="font-bold text-yellow-600">{pendingTasks.length} tasks</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Assignments</span>
                        <span className="font-bold text-purple-600">{myAssignments.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Approved NGOs</span>
                        <span className="font-bold text-blue-600">{approvedNgoCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Rating</span>
                        <span className="font-bold text-orange-600">
                          {profileData.rating > 0 ? `${profileData.rating.toFixed(1)}/5 ⭐` : 'No rating yet'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Status</span>
                        <span className={`font-bold ${statusColor.text}`}>{availabilityStatus}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Member Since</span>
                        <span className="font-medium text-gray-700 text-xs">
                          {new Date(user?.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Approved NGOs */}
                {myNgos.filter(n => n.status === 'approved').length > 0 && (
                  <div className="bg-white rounded-2xl p-5 shadow-md border">
                    <h4 className="text-sm font-semibold text-gray-600 mb-3">✅ Approved NGOs</h4>
                    <div className="flex flex-wrap gap-2">
                      {myNgos.filter(n => n.status === 'approved').map(app => (
                        <span key={app._id} className="bg-green-100 text-green-700 px-3 py-1.5 rounded-full text-xs font-medium">
                          ✅ {app.ngoId?.name || 'NGO'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {profileData.bio && (
                  <div className="bg-white rounded-2xl p-5 shadow-md border">
                    <h4 className="text-sm font-semibold text-gray-600 mb-2">About</h4>
                    <p className="text-sm text-gray-700">{profileData.bio}</p>
                  </div>
                )}

                {profileData.skills.length > 0 && (
                  <div className="bg-white rounded-2xl p-5 shadow-md border">
                    <h4 className="text-sm font-semibold text-gray-600 mb-3">🛠️ Skills</h4>
                    <div className="flex flex-wrap gap-2">
                      {profileData.skills.map(skill => (
                        <span key={skill} className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-xs font-medium">
                          ✓ {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {profileData.interests.length > 0 && (
                  <div className="bg-white rounded-2xl p-5 shadow-md border">
                    <h4 className="text-sm font-semibold text-gray-600 mb-3">♥ Interests</h4>
                    <div className="flex flex-wrap gap-2">
                      {profileData.interests.map(interest => (
                        <span key={interest} className="bg-purple-100 text-purple-700 px-3 py-1.5 rounded-full text-xs font-medium">
                          ♥ {interest}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════
            MAP TAB
        ══════════════════════════════════════ */}
        {activeTab === 'map' && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden border">
            <div className="px-6 py-4 border-b bg-gray-50">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800">🗺️ Tasks Near You</h2>
              <p className="text-xs text-gray-500 mt-1">
                🟢 You • 🔴 High Urgency • 🟠 Medium • 🔵 Normal
              </p>
            </div>
            <div ref={mapContainer} className="w-full h-96 sm:h-[500px]" />
            <div className="border-t max-h-64 overflow-y-auto divide-y">
              {tasks.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  No tasks to display. Apply to an NGO to see tasks.
                </div>
              ) : tasks.map(task => {
                const isApplied = appliedTaskIds.includes(task._id)
                const filledSlots = task.assignedVolunteers?.filter(
                  v => v.status === 'accepted' || v.status === 'approved'
                ).length || 0
                const isFull = filledSlots >= task.volunteersNeeded

                return (
                  <div key={task._id} className="p-3 hover:bg-gray-50 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xl flex-shrink-0">{getTaskIcon(task.category)}</span>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-gray-800 truncate">{task.title}</p>
                        <p className="text-xs text-gray-500">
                          {task.locationName?.split(',')[0] || 'Unknown'} • {task.distance || '?'}km
                          {isFull && ' • ❌ Full'}
                        </p>
                      </div>
                    </div>
                    {isApplied ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium flex-shrink-0">
                        ✅ Applied
                      </span>
                    ) : isFull ? (
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-medium flex-shrink-0">
                        ❌ Full
                      </span>
                    ) : (
                      <button
                        onClick={() => handleApplyTask(task._id)}
                        disabled={actionLoading === task._id || availabilityStatus !== 'FREE'}
                        className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 flex-shrink-0"
                      >
                        {availabilityStatus !== 'FREE' ? '🔒' : 'Apply'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ══ NGO APPLY MODAL ══ */}
      {showNgoApplyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="text-center mb-5">
              <div className="text-5xl mb-3">📩</div>
              <h3 className="text-lg font-bold text-gray-800">Apply to {showNgoApplyModal.name}</h3>
              <p className="text-sm text-gray-500 mt-1">
                Request access to volunteer for this NGO
              </p>
              {showNgoApplyModal.locationName && (
                <p className="text-xs text-gray-400 mt-1">📍 {showNgoApplyModal.locationName}</p>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
              <p className="text-xs text-blue-800">
                💡 Once approved by the committee, you'll be able to see and apply to tasks from this NGO.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowNgoApplyModal(null)}
                className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl text-gray-600 font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handleApplyToNgo(showNgoApplyModal._id)}
                disabled={applyingNgoId === showNgoApplyModal._id}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {applyingNgoId === showNgoApplyModal._id ? '⏳ Applying...' : '📩 Submit Application'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}