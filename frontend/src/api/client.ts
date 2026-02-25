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
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

// Auth endpoints (fastapi-users uses OAuth2 form encoding for login)
export const authApi = {
  login: (email: string, password: string) => {
    const form = new URLSearchParams()
    form.append('username', email)
    form.append('password', password)
    return apiClient.post<{ access_token: string; token_type: string }>(
      '/auth/jwt/login',
      form,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    )
  },
  logout: () => apiClient.post('/auth/jwt/logout'),
  register: (data: { email: string; password: string; role?: string }) =>
    apiClient.post('/auth/register', data),
  me: () => apiClient.get('/users/me'),
}

// Resource endpoints
export const instrumentsApi = {
  list: () => apiClient.get('/api/instruments'),
  get: (id: string) => apiClient.get(`/api/instruments/${id}`),
  create: (data: unknown) => apiClient.post('/api/instruments', data),
  update: (id: string, data: unknown) => apiClient.patch(`/api/instruments/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/instruments/${id}`),
}

export const serviceAccountsApi = {
  list: () => apiClient.get('/api/service-accounts'),
  get: (id: string) => apiClient.get(`/api/service-accounts/${id}`),
  create: (data: unknown) => apiClient.post('/api/service-accounts', data),
  update: (id: string, data: unknown) => apiClient.patch(`/api/service-accounts/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/service-accounts/${id}`),
}

export const storageApi = {
  list: () => apiClient.get('/api/storage-locations'),
  get: (id: string) => apiClient.get(`/api/storage-locations/${id}`),
  create: (data: unknown) => apiClient.post('/api/storage-locations', data),
  update: (id: string, data: unknown) => apiClient.patch(`/api/storage-locations/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/storage-locations/${id}`),
}

export const schedulesApi = {
  list: () => apiClient.get('/api/schedules'),
  get: (id: string) => apiClient.get(`/api/schedules/${id}`),
  create: (data: unknown) => apiClient.post('/api/schedules', data),
  update: (id: string, data: unknown) => apiClient.patch(`/api/schedules/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/schedules/${id}`),
}

export const hooksApi = {
  list: () => apiClient.get('/api/hooks'),
  get: (id: string) => apiClient.get(`/api/hooks/${id}`),
  create: (data: unknown) => apiClient.post('/api/hooks', data),
  update: (id: string, data: unknown) => apiClient.patch(`/api/hooks/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/hooks/${id}`),
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
  list: () => apiClient.get('/api/admin/users'),
  get: (id: string) => apiClient.get(`/users/${id}`),
  update: (id: string, data: unknown) => apiClient.patch(`/users/${id}`, data),
  delete: (id: string) => apiClient.delete(`/users/${id}`),
}

export const projectsApi = {
  list: () => apiClient.get('/api/projects'),
  get: (id: string) => apiClient.get(`/api/projects/${id}`),
  create: (data: unknown) => apiClient.post('/api/projects', data),
  update: (id: string, data: unknown) => apiClient.patch(`/api/projects/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/projects/${id}`),
}

export const healthApi = {
  check: () => apiClient.get('/health'),
}
