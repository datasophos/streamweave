import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token from localStorage on every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On 401, clear token and redirect to login
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token')
      const next = window.location.pathname + (window.location.search ?? '')
      window.location.href =
        next && !next.startsWith('/login') ? `/login?next=${encodeURIComponent(next)}` : '/login'
    }
    return Promise.reject(error)
  }
)

// Auth endpoints (fastapi-users uses OAuth2 form encoding for login)
export const authApi = {
  login: (email: string, password: string) => {
    const form = new URLSearchParams()
    form.append('username', email)
    form.append('password', password)
    return apiClient.post<{ access_token: string; token_type: string }>('/auth/jwt/login', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
  },
  logout: () => apiClient.post('/auth/jwt/logout'),
  register: (data: { email: string; password: string; role?: string }) =>
    apiClient.post('/auth/register', data),
  me: () => apiClient.get('/users/me'),
  requestVerification: (email: string) => apiClient.post('/auth/request-verify-token', { email }),
  verifyEmail: (token: string) => apiClient.post('/auth/verify', { token }),
  forgotPassword: (email: string) => apiClient.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) =>
    apiClient.post('/auth/reset-password', { token, password }),
}

// Resource endpoints
export const instrumentsApi = {
  list: (params?: { include_deleted?: boolean }) => apiClient.get('/api/instruments', { params }),
  get: (id: string) => apiClient.get(`/api/instruments/${id}`),
  create: (data: unknown) => apiClient.post('/api/instruments', data),
  update: (id: string, data: unknown) => apiClient.patch(`/api/instruments/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/instruments/${id}`),
  restore: (id: string) => apiClient.post(`/api/instruments/${id}/restore`),
}

export const serviceAccountsApi = {
  list: (params?: { include_deleted?: boolean }) =>
    apiClient.get('/api/service-accounts', { params }),
  get: (id: string) => apiClient.get(`/api/service-accounts/${id}`),
  create: (data: unknown) => apiClient.post('/api/service-accounts', data),
  update: (id: string, data: unknown) => apiClient.patch(`/api/service-accounts/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/service-accounts/${id}`),
  restore: (id: string) => apiClient.post(`/api/service-accounts/${id}/restore`),
}

export const storageApi = {
  list: (params?: { include_deleted?: boolean }) =>
    apiClient.get('/api/storage-locations', { params }),
  get: (id: string) => apiClient.get(`/api/storage-locations/${id}`),
  create: (data: unknown) => apiClient.post('/api/storage-locations', data),
  update: (id: string, data: unknown) => apiClient.patch(`/api/storage-locations/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/storage-locations/${id}`),
  restore: (id: string) => apiClient.post(`/api/storage-locations/${id}/restore`),
}

export const schedulesApi = {
  list: (params?: { include_deleted?: boolean }) => apiClient.get('/api/schedules', { params }),
  get: (id: string) => apiClient.get(`/api/schedules/${id}`),
  create: (data: unknown) => apiClient.post('/api/schedules', data),
  update: (id: string, data: unknown) => apiClient.patch(`/api/schedules/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/schedules/${id}`),
  restore: (id: string) => apiClient.post(`/api/schedules/${id}/restore`),
}

export const hooksApi = {
  list: (params?: { include_deleted?: boolean }) => apiClient.get('/api/hooks', { params }),
  get: (id: string) => apiClient.get(`/api/hooks/${id}`),
  create: (data: unknown) => apiClient.post('/api/hooks', data),
  update: (id: string, data: unknown) => apiClient.patch(`/api/hooks/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/hooks/${id}`),
  restore: (id: string) => apiClient.post(`/api/hooks/${id}/restore`),
}

export const filesApi = {
  list: (params?: Record<string, unknown>) => apiClient.get('/api/files', { params }),
  get: (id: string) => apiClient.get(`/api/files/${id}`),
}

export const transfersApi = {
  list: (params?: Record<string, unknown>) => apiClient.get('/api/transfers', { params }),
  get: (id: string) => apiClient.get(`/api/transfers/${id}`),
}

export const usersApi = {
  list: (params?: { include_deleted?: boolean }) => apiClient.get('/api/admin/users', { params }),
  get: (id: string) => apiClient.get(`/users/${id}`),
  update: (id: string, data: unknown) => apiClient.patch(`/users/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/admin/users/${id}`),
  restore: (id: string) => apiClient.post(`/api/admin/users/${id}/restore`),
}

export const projectsApi = {
  list: () => apiClient.get('/api/projects'),
  get: (id: string) => apiClient.get(`/api/projects/${id}`),
  create: (data: unknown) => apiClient.post('/api/projects', data),
  update: (id: string, data: unknown) => apiClient.patch(`/api/projects/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/projects/${id}`),
}

export const meApi = {
  update: (data: { email?: string; password?: string }) => apiClient.patch('/users/me', data),
}

export const healthApi = {
  check: () => apiClient.get('/health'),
}

export const auditApi = {
  list: (params?: {
    entity_type?: string
    action?: string
    actor_id?: string
    since?: string
    until?: string
    limit?: number
    offset?: number
  }) => apiClient.get('/api/admin/audit-logs', { params }),
}
