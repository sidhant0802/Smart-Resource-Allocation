import axios from 'axios'

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
})

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

API.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const message =
      err.response?.data?.error ||
      err.response?.data?.message ||
      err.message
    throw new Error(message)
  }
)

// ═══════════════════════════════════════
// Auth
// ═══════════════════════════════════════
export const authApi = {
  register: (data) => API.post('/auth/register', data),
  login: (data) => API.post('/auth/login', data),
  getMe: () => API.get('/auth/me'),
  signup: (data) => API.post('/auth/register', data),
  getApprovedNgos: (params) => API.get('/auth/approved-ngos', { params }),
}

// ═══════════════════════════════════════
// Upload / Staff
// ═══════════════════════════════════════
export const uploadApi = {
  uploadFile: (formData) =>
    API.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getStatus: (reportId) => API.get(`/upload/status/${reportId}`),
  getMyReports: () => API.get('/reports/my-reports'),
  updateVisibility: (reportId, visibility) =>
    API.put(`/reports/${reportId}/visibility`, { visibility }),
  getStaffProfile: () => API.get('/upload/profile'),
  getMyApplications: () => API.get('/upload/my-applications'),
  getNearbyNgos: (params) => API.get('/upload/nearby-ngos', { params }),
  getNgoZones: (ngoId) => API.get(`/upload/ngo/${ngoId}/zones`),
  applyToNgo: (data) => API.post('/upload/apply-ngo', data),

  // Tasks for NGO Staff
  getAvailableTasksInArea: (params) =>
    API.get('/volunteers/tasks-in-area', { params }),
  getMyTaskApplications: () =>
    API.get('/volunteers/my-task-applications'),
  applyToTask: (data) =>
    API.post(`/volunteers/tasks/${data.taskId}/apply`, {}),
}

// ═══════════════════════════════════════
// Chat
// ═══════════════════════════════════════
export const chatApi = {
  sendMessage: (data) => API.post('/chat/message', data),
}

// ═══════════════════════════════════════
// Reports (Committee)
// ═══════════════════════════════════════
export const reportApi = {
  getZoneReports: (params) => API.get('/reports/zone', { params }),
  getZoneStats: () => API.get('/reports/zone/stats'),
  reviewReport: (reportId, data) => API.put(`/reports/${reportId}/review`, data),
  getReport: (reportId) => API.get(`/reports/${reportId}`),
  getZoneStaff: () => API.get('/reports/zone/staff'),
  getZonePendingStaff: () => API.get('/reports/zone/pending-staff'),
  reviewStaffApp: (staffId, data) =>
    API.patch(`/reports/zone/staff/${staffId}/review`, data),
  getVolunteerApplications: (params) =>
    API.get('/reports/zone/volunteer-applications', { params }),
  reviewVolunteerApp: (applicationId, data) =>
    API.patch(`/reports/zone/volunteer-applications/${applicationId}/review`, data),
  getZoneTasks: (params) => API.get('/reports/zone/tasks', { params }),
  getApprovedVolunteers: () => API.get('/reports/zone/approved-volunteers'),
  getCommitteeProfile: () => API.get('/reports/zone/profile'),
}

// ═══════════════════════════════════════
// Tasks
// ═══════════════════════════════════════
export const taskApi = {
  // Create task (committee)
  createTask: (data) => API.post('/tasks', data),

  // Get task details
  getTaskDetails: (taskId) => API.get(`/tasks/${taskId}`),

  // Apply to task (volunteer - uses volunteer routes)
  applyToTask: (taskId) =>
    API.post(`/volunteers/tasks/${taskId}/apply`, {}),

  // Respond to invitation
  respondToInvitation: (taskId, data) =>
    API.post(`/tasks/${taskId}/respond`, data),

  // Complete task
  completeTask: (taskId, data) =>
    API.patch(`/tasks/${taskId}/complete`, data),

  // Assign volunteers manually
  assignVolunteers: (taskId, data) =>
    API.post(`/tasks/${taskId}/assign-volunteers`, data),

  // Update duration
  updateDuration: (taskId, data) =>
    API.patch(`/tasks/${taskId}/duration`, data),

  // Get pending volunteer applications (committee)
  getPendingApplications: () =>
    API.get('/tasks/applications/pending'),

  // Review volunteer application (committee)
  reviewTaskVolunteer: (taskId, volunteerId, data) =>
    API.patch(`/tasks/${taskId}/volunteers/${volunteerId}/review`, data),
}

// ═══════════════════════════════════════
// Volunteer
// ═══════════════════════════════════════
export const volunteerApi = {
  getDashboard: () => API.get('/volunteers/dashboard'),
  getAvailableTasks: (params) => API.get('/volunteers/tasks', { params }),
  applyToNGO: (data) => API.post('/volunteers/apply-ngo', data),
  getMyNGOs: () => API.get('/volunteers/my-ngos'),
  updateProfile: (data) => API.put('/volunteers/profile', data),
  updateLocation: (data) => API.put('/volunteers/location', data),

  // Prevent duplicate applications
  getAppliedTaskIds: () =>
    API.get('/volunteers/tasks/applied-ids'),

  // My committee assignments
  getMyAssignments: () =>
    API.get('/volunteers/my-assignments'),

  // Get all approved NGOs
  getAllNgos: () => API.get('/auth/approved-ngos'),

  // NGO Staff helpers
  searchNGOs: (params) => API.get('/volunteers/search-ngos', { params }),
  getMyNGOTasks: (params) => API.get('/volunteers/my-ngo-tasks', { params }),
  submitReport: (data) => API.post('/volunteers/submit-report', data),
}

// ═══════════════════════════════════════
// Super Admin
// ═══════════════════════════════════════
export const superAdminApi = {
  getStats: () => API.get('/super-admin/stats'),
  getDashboard: () => API.get('/super-admin/dashboard'),
  getAllNgos: (params) => API.get('/super-admin/ngos', { params }),
  approveNgo: (ngoId) => API.patch(`/super-admin/ngos/${ngoId}/approve`),
  declineNgo: (ngoId, data) =>
    API.patch(`/super-admin/ngos/${ngoId}/decline`, data),
  suspendNgo: (ngoId, data) =>
    API.patch(`/super-admin/ngos/${ngoId}/suspend`, data),
  deleteNgo: (ngoId) => API.delete(`/super-admin/ngos/${ngoId}`),
  getNgoDetails: (ngoId) => API.get(`/super-admin/ngos/${ngoId}`),
  getAllUsers: (params) => API.get('/super-admin/users', { params }),
  updateUserStatus: (userId, data) =>
    API.patch(`/super-admin/users/${userId}/status`, data),
  deleteUser: (userId) => API.delete(`/super-admin/users/${userId}`),
  getAllZones: (params) => API.get('/super-admin/zones', { params }),
  getAllReports: (params) => API.get('/super-admin/reports', { params }),
  getVolunteerApplications: (params) =>
    API.get('/super-admin/volunteer-applications', { params }),
}

// ═══════════════════════════════════════
// NGO Manager
// ═══════════════════════════════════════
export const ngoManagerApi = {
  getDashboard: () => API.get('/ngo-manager/dashboard'),
  createZone: (data) => API.post('/ngo-manager/zones', data),
  deleteZone: (zoneId) => API.delete(`/ngo-manager/zones/${zoneId}`),
  approveCommittee: (memberId, zoneId) =>
    API.post('/ngo-manager/approve-committee', { memberId, zoneId }),
  approveStaff: (memberId, zoneId) =>
    API.post('/ngo-manager/approve-staff', { memberId, zoneId }),
  declineUser: (memberId) =>
    API.delete(`/ngo-manager/decline/${memberId}`),
  reviewVolunteerApp: (applicationId, data) =>
    API.patch(`/ngo-manager/volunteer-applications/${applicationId}/review`, data),
  getNgoReports: (params) => API.get('/ngo-manager/reports', { params }),
  getReportStats: () => API.get('/ngo-manager/reports/stats'),
  reviewReport: (reportId, data) =>
    API.put(`/ngo-manager/reports/${reportId}/review`, data),
  deleteReport: (reportId) =>
    API.delete(`/ngo-manager/reports/${reportId}`),
}

// ═══════════════════════════════════════
// Assignments (Worker Assignment System)
// ═══════════════════════════════════════
export const assignmentApi = {
  // Committee: Create assignment
  createAssignment: (data) => API.post('/assignments', data),

  // Committee: Assign volunteer to slot
  assignVolunteer: (assignmentId, data) =>
    API.post(`/assignments/${assignmentId}/assign-volunteer`, data),

  // Committee: Get their assignments
  getMyAssignments: (status) =>
    API.get(`/assignments/my-assignments?status=${status || ''}`),

  // Get assignment details
  getAssignment: (assignmentId) =>
    API.get(`/assignments/${assignmentId}`),

  // Volunteer: Approve via email link (no auth needed)
  volunteerApprove: (token) =>
    API.post(`/assignments/approve/${token}`),

  // Volunteer: Reject via email link (no auth needed)
  volunteerReject: (token, data) =>
    API.post(`/assignments/reject/${token}`, data || {}),

  // Volunteer: Get pending assignments
  getVolunteerPending: () =>
    API.get('/assignments/volunteer/pending'),
}