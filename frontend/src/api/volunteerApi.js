const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('token')}`
})

// Get volunteer dashboard data
export const getDashboardData = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/volunteer/dashboard`, {
      method: 'GET',
      headers: getHeaders()
    })
    if (!response.ok) throw new Error('Failed to fetch dashboard')
    return await response.json()
  } catch (error) {
    console.error('Error:', error)
    throw error
  }
}

// Get available tasks
export const getAvailableTasks = async (filters = {}) => {
  try {
    const params = new URLSearchParams(filters)
    const response = await fetch(`${API_BASE_URL}/volunteer/tasks?${params}`, {
      method: 'GET',
      headers: getHeaders()
    })
    if (!response.ok) throw new Error('Failed to fetch tasks')
    return await response.json()
  } catch (error) {
    console.error('Error:', error)
    throw error
  }
}

// Apply to NGO
export const applyToNGO = async (ngoId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/volunteer/apply-ngo`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ ngoId })
    })
    if (!response.ok) throw new Error('Failed to apply')
    return await response.json()
  } catch (error) {
    console.error('Error:', error)
    throw error
  }
}

// Get my NGOs
export const getMyNGOs = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/volunteer/my-ngos`, {
      method: 'GET',
      headers: getHeaders()
    })
    if (!response.ok) throw new Error('Failed to fetch NGOs')
    return await response.json()
  } catch (error) {
    console.error('Error:', error)
    throw error
  }
}

// ✅ NEW: Update profile
export const updateProfile = async (profileData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/volunteer/profile`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(profileData)
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'Failed to update profile')
    return data
  } catch (error) {
    console.error('Error:', error)
    throw error
  }
}

// ✅ NEW: Update location
export const updateLocation = async (coordinates, locationName) => {
  try {
    const response = await fetch(`${API_BASE_URL}/volunteer/location`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ coordinates, locationName })
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'Failed to update location')
    return data
  } catch (error) {
    console.error('Error:', error)
    throw error
  }
}

const volunteerApi = {
  getDashboardData,
  getAvailableTasks,
  applyToNGO,
  getMyNGOs,
  updateProfile,
  updateLocation
}

export default volunteerApi