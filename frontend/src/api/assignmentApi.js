import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const getAuthHeader = () => {
  const token = localStorage.getItem('token')
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  }
}

export const assignmentApi = {
  // Create new assignment
  createAssignment: async (data) => {
    const res = await axios.post(
      `${API_URL}/assignments`,
      data,
      getAuthHeader()
    )
    return res.data
  },

  // Assign volunteer to slot
  assignVolunteer: async (assignmentId, data) => {
    const res = await axios.post(
      `${API_URL}/assignments/${assignmentId}/assign-volunteer`,
      data,
      getAuthHeader()
    )
    return res.data
  },

  // Get assignment details
  getAssignment: async (assignmentId) => {
    const res = await axios.get(
      `${API_URL}/assignments/${assignmentId}`,
      getAuthHeader()
    )
    return res.data
  },

  // Get committee's assignments
  getMyAssignments: async (status) => {
    const res = await axios.get(
      `${API_URL}/assignments/my-assignments?status=${status || ''}`,
      getAuthHeader()
    )
    return res.data
  },

  // Volunteer approve assignment
  volunteerApprove: async (token) => {
    const res = await axios.post(`${API_URL}/assignments/approve/${token}`)
    return res.data
  },

  // Volunteer reject assignment
  volunteerReject: async (token, data) => {
    const res = await axios.post(
      `${API_URL}/assignments/reject/${token}`,
      data
    )
    return res.data
  },

  // Get volunteer's pending assignments
  getVolunteerPending: async () => {
    const res = await axios.get(
      `${API_URL}/assignments/volunteer/pending`,
      getAuthHeader()
    )
    return res.data
  },
}