const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('token')}`
})

// ── Dashboard ──────────────────────────────────────────────
export const getDashboardData = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/volunteers/dashboard`, {
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

// ── Available Tasks ────────────────────────────────────────
export const getAvailableTasks = async (filters = {}) => {
  try {
    const params = new URLSearchParams(filters)
    const response = await fetch(`${API_BASE_URL}/volunteers/tasks?${params}`, {
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

// ── NGO Applications ───────────────────────────────────────

// Apply to NGO (volunteer)
export const applyToNGO = async (ngoId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/volunteers/apply-ngo`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ ngoId })
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || data.error || 'Failed to apply')
    return data
  } catch (error) {
    console.error('Error:', error)
    throw error
  }
}

// Get my NGOs
export const getMyNGOs = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/volunteers/my-ngos`, {
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

// ✅ NEW: Get all approved NGOs to apply to
export const getAllNgos = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/approved-ngos`, {
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

// ── Profile ────────────────────────────────────────────────
export const updateProfile = async (profileData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/volunteers/profile`, {
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

// ── Location ───────────────────────────────────────────────
export const updateLocation = async (coordinates, locationName) => {
  try {
    const response = await fetch(`${API_BASE_URL}/volunteers/location`, {
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

// ── Tasks ──────────────────────────────────────────────────

// ✅ FIXED: Apply to task (correct endpoint)
export const applyToTask = async (taskId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/volunteers/tasks/${taskId}/apply`, {
      method: 'POST',
      headers: getHeaders()
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || data.message || 'Failed to apply')
    return data
  } catch (error) {
    console.error('Error:', error)
    throw error
  }
}

// ✅ NEW: Get task IDs already applied to (prevent duplicates)
export const getAppliedTaskIds = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/volunteers/tasks/applied-ids`, {
      method: 'GET',
      headers: getHeaders()
    })
    if (!response.ok) return { taskIds: [] }
    return await response.json()
  } catch (error) {
    console.error('Error:', error)
    return { taskIds: [] }
  }
}

// ✅ NEW: Get my worker assignments (from committee)
export const getMyAssignments = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/volunteers/my-assignments`, {
      method: 'GET',
      headers: getHeaders()
    })
    if (!response.ok) return { assignments: [] }
    return await response.json()
  } catch (error) {
    console.error('Error:', error)
    return { assignments: [] }
  }
}

// Complete task
export const completeTask = async (taskId, feedbackData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/complete`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(feedbackData)
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'Failed to complete task')
    return data
  } catch (error) {
    console.error('Error:', error)
    throw error
  }
}

// ── Export ─────────────────────────────────────────────────
const volunteerApi = {
  getDashboardData,
  getAvailableTasks,
  applyToNGO,
  getMyNGOs,
  getAllNgos,
  updateProfile,
  updateLocation,
  applyToTask,
  getAppliedTaskIds,
  getMyAssignments,
  completeTask,
}

export default volunteerApi