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

// Add these to authApi:
export const authApi = {
  register: (data) => API.post('/auth/register', data),
  login: (data) => API.post('/auth/login', data),
  getMe: () => API.get('/auth/me'),

  // ✅ Add these:
  signup: (data) => API.post('/auth/register', data),
  getApprovedNgos: () => API.get('/auth/approved-ngos'),
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
  reviewReport: (reportId, data) =>
    API.put(`/reports/${reportId}/review`, data),
  getReport: (reportId) => API.get(`/reports/${reportId}`),
  getZoneStaff: () => API.get('/reports/zone/staff'),
  getVolunteerApplications: (params) =>
    API.get('/reports/zone/volunteer-applications', { params }),
  reviewVolunteerApp: (applicationId, data) =>
    API.patch(
      `/reports/zone/volunteer-applications/${applicationId}/review`,
      data
    ),
  getZoneTasks: (params) => API.get('/reports/zone/tasks', { params }),
  getApprovedVolunteers: () => API.get('/reports/zone/approved-volunteers'),
  getCommitteeProfile: () => API.get('/reports/zone/profile'),
}

// ═══════════════════════════════════════
// Tasks
// ═══════════════════════════════════════
export const taskApi = {
  createTask: (data) => API.post('/tasks', data),
  getTaskDetails: (taskId) => API.get(`/tasks/${taskId}`),
  applyToTask: (taskId) => API.post(`/tasks/${taskId}/apply`),
  respondToInvitation: (taskId, data) =>
    API.post(`/tasks/${taskId}/respond`, data),
  completeTask: (taskId, data) =>
    API.patch(`/tasks/${taskId}/complete`, data),
  assignVolunteers: (taskId, data) =>
    API.post(`/tasks/${taskId}/assign-volunteers`, data),
  updateDuration: (taskId, data) =>
    API.patch(`/tasks/${taskId}/duration`, data),
  getPendingApplications: () => API.get('/tasks/applications/pending'),
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
// NGO Manager ← THIS WAS MISSING/INCOMPLETE
// ═══════════════════════════════════════
export const ngoManagerApi = {
  // Dashboard
  getDashboard: () => API.get('/ngo-manager/dashboard'),

  // Zones
  createZone: (data) => API.post('/ngo-manager/zones', data),
  deleteZone: (zoneId) => API.delete(`/ngo-manager/zones/${zoneId}`),

  // Approvals
  approveCommittee: (memberId, zoneId) =>
    API.post('/ngo-manager/approve-committee', { memberId, zoneId }),
  approveStaff: (memberId, zoneId) =>
    API.post('/ngo-manager/approve-staff', { memberId, zoneId }),
  declineUser: (memberId) =>
    API.delete(`/ngo-manager/decline/${memberId}`),

  // ✅ Reports - these were missing
  getNgoReports: (params) =>
    API.get('/ngo-manager/reports', { params }),
  getReportStats: () =>
    API.get('/ngo-manager/reports/stats'),
  reviewReport: (reportId, data) =>
    API.put(`/ngo-manager/reports/${reportId}/review`, data),
  deleteReport: (reportId) =>
    API.delete(`/ngo-manager/reports/${reportId}`),
}