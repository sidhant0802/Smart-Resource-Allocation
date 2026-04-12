const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

// Volunteer applies to an open task
export const applyToTask = async (taskId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'Failed to apply')
    return data
  } catch (error) {
    console.error('Error:', error)
    throw error
  }
}

// Respond to task invitation (when pre-invited)
export const respondToInvitation = async (taskId, response) => {
  try {
    const apiResponse = await fetch(`${API_BASE_URL}/tasks/${taskId}/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ response })
    })
    const data = await apiResponse.json()
    if (!apiResponse.ok) throw new Error(data.message || 'Failed to respond')
    return data
  } catch (error) {
    console.error('Error:', error)
    throw error
  }
}

// Complete task
export const completeTask = async (taskId, data = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/complete`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(data)
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.message || 'Failed to complete task')
    return result
  } catch (error) {
    console.error('Error:', error)
    throw error
  }
}

// Get task details
export const getTaskDetails = async (taskId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'Failed to fetch task')
    return data
  } catch (error) {
    console.error('Error:', error)
    throw error
  }
}

const taskApi = {
  applyToTask,
  respondToInvitation,
  completeTask,
  getTaskDetails
}

export default taskApi