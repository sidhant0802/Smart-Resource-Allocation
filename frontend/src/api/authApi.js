import axios from 'axios'

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
})

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

API.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'Something went wrong'

    if (
      error.response?.status === 401 &&
      !window.location.pathname.includes('/login')
    ) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }

    return Promise.reject(new Error(message))
  }
)

export const authApi = {
  signup:          (data) => API.post('/auth/signup', data),
  login:           (data) => API.post('/auth/login', data),
  getMe:           ()     => API.get('/auth/me'),
  getApprovedNgos: ()     => API.get('/auth/ngos/approved'),
}

export const superAdminApi = {
  getStats:   ()              => API.get('/super-admin/stats'),
  getAllNgos:  ()              => API.get('/super-admin/ngos'),
  approveNgo: (ngoId)         => API.put(`/super-admin/ngos/${ngoId}/approve`),
  declineNgo: (ngoId, reason) => API.put(`/super-admin/ngos/${ngoId}/decline`, { reason }),
  suspendNgo: (ngoId, reason) => API.put(`/super-admin/ngos/${ngoId}/suspend`, { reason }),
}

export const ngoManagerApi = {
  getDashboard:     ()                   => API.get('/ngo-manager/dashboard'),
  createZone:       (data)               => API.post('/ngo-manager/zones', data),
  deleteZone:       (zoneId)             => API.delete(`/ngo-manager/zones/${zoneId}`),
  approveCommittee: (memberId, zoneId)   => API.put(`/ngo-manager/committee/${memberId}/approve`, { zoneId }),
  approveStaff:     (memberId, zoneId)   => API.put(`/ngo-manager/staff/${memberId}/approve`, { zoneId }),
  declineUser:      (memberId)           => API.put(`/ngo-manager/users/${memberId}/decline`),
}

export const uploadApi = {
  uploadFile:       (formData) =>
    API.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getStatus:        (reportId)             => API.get(`/upload/status/${reportId}`),
  getMyReports:     ()                     => API.get('/reports/my-reports'),
  updateVisibility: (reportId, visibility) => API.put(`/reports/${reportId}/visibility`, { visibility }),
}

export const reportApi = {
  getZoneReports: (params) => API.get('/reports/zone', { params }),
  getZoneStats:   ()       => API.get('/reports/zone/stats'),
  getReport:      (id)     => API.get(`/reports/${id}`),
  reviewReport:   (id, data) => API.put(`/reports/${id}/review`, data),
}

// ✅ chatApi MUST be after API is created
export const chatApi = {
  sendMessage: (data)     => API.post('/chat', data),
  getHistory:  (reportId) => API.get(`/chat/${reportId}`),
}