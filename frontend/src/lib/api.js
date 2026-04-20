import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('geply_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('geply_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const authApi = {
  login:         (data) => api.post('/auth/login', data),
  register:      (data) => api.post('/auth/register', data),
  me:            ()     => api.get('/auth/me'),
  // Supports full_name, company, company_kb
  updateProfile: (data) => api.patch('/auth/profile', data),
  stats:         ()     => api.get('/auth/stats'),
}

export const jobsApi = {
  list:           (offset = 0, limit = 50) => api.get(`/jobs?offset=${offset}&limit=${limit}`),
  get:            (id)       => api.get(`/jobs/${id}`),
  create:         (formData) => api.post('/jobs', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  // Supports: title, description, requirements, status, interview_duration_minutes,
  //           max_questions, office_locations (string), shift_flexible (bool)
  update:         (id, data) => api.patch(`/jobs/${id}`, data),
  delete:         (id)       => api.delete(`/jobs/${id}`),
  uploadResumes:  (jobId, formData) => api.post(`/jobs/${jobId}/resumes`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  generateInvites:(jobId)    => api.post(`/jobs/${jobId}/invites`),
}

export const candidatesApi = {
  listByJob:   (jobId, offset = 0, limit = 100) => api.get(`/candidates/job/${jobId}?offset=${offset}&limit=${limit}`),
  get:         (id)           => api.get(`/candidates/${id}`),
  update:      (id, data)     => api.patch(`/candidates/${id}`, data),
  updateStatus:(id, status)   => api.patch(`/candidates/${id}/status?status=${status}`),
  delete:      (id)           => api.delete(`/candidates/${id}`),
  consent:     (id, data)     => api.post(`/candidates/${id}/consent`, data),
  reInterview: (id, reason)   => api.post(`/candidates/${id}/re-interview`, { reason }),
  bulkInvite:  (jobId, candidateIds) => api.post('/candidates/bulk-invite', { job_id: jobId, candidate_ids: candidateIds }),
}

export const interviewsApi = {
  listByJob:       (jobId)       => api.get(`/interviews/job/${jobId}`),
  getRoomToken:    (inviteToken) => api.post(`/interviews/room-token?invite_token=${encodeURIComponent(inviteToken)}`),
  sendProctorEvent:(data)        => api.post('/interviews/proctor-event', data),
}

export const schedulesApi = {
  createSlots:       (data)   => api.post('/schedules/slots', data),
  getAvailable:      (token)  => api.get(`/schedules/available?invite_token=${encodeURIComponent(token)}`),
  book:              (data)   => api.post('/schedules/book', data),
  selfSchedule:      (data)   => api.post('/schedules/self-schedule', data),
  requestReInterview:(token)  => api.post(`/schedules/request-re-interview?candidate_token=${encodeURIComponent(token)}`),
}

export const reportsApi = {
  listByJob:     (jobId)       => api.get(`/reports/job/${jobId}`),
  get:           (id)          => api.get(`/reports/${id}`),
  getByInterview:(interviewId) => api.get(`/reports/interview/${interviewId}`),
}

export const notificationsApi = {
  list:       (unreadOnly = false, limit = 50) => api.get(`/notifications?unread_only=${unreadOnly}&limit=${limit}`),
  unreadCount:()     => api.get('/notifications/unread-count'),
  markRead:   (id)   => api.patch(`/notifications/${id}/read`),
  markAllRead:()     => api.patch('/notifications/read-all'),
  remove:     (id)   => api.delete(`/notifications/${id}`),
}

export default api

export const settingsApi = {
  getKb:    () => api.get('/auth/settings/kb'),
  updateKb: (company_kb) => api.patch('/auth/settings/kb', { company_kb }),
}
