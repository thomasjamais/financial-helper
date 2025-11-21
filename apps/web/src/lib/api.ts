import axios, { type AxiosInstance } from 'axios'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

// Create axios instance with base configuration
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Function to update the authorization token
export function setAuthToken(token: string | null): void {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`
  } else {
    delete apiClient.defaults.headers.common['Authorization']
  }
}

// Request interceptor to add token from localStorage if available
apiClient.interceptors.request.use(
  (config) => {
    // Always check localStorage first (most up-to-date)
    const token = localStorage.getItem('accessToken')
    if (token) {
      // Always set the Authorization header if token exists
      // This ensures the token is always sent, even if it was previously set
      config.headers.Authorization = `Bearer ${token}`
    } else {
      // If no token in localStorage, remove the header
      delete config.headers.Authorization
      // Log warning in development to help debug
      if (import.meta.env.DEV) {
        console.warn('[apiClient] No access token found in localStorage for request:', config.url)
      }
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

// Response interceptor to handle 401 errors (token expired)
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // If 401 and we haven't already retried, try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      const refreshToken = localStorage.getItem('refreshToken')
      if (refreshToken) {
        try {
          // Use a plain axios instance for refresh to avoid circular interceptor calls
          const response = await axios.post(
            `${API_BASE}/v1/auth/refresh`,
            { refreshToken },
            {
              headers: {
                'Content-Type': 'application/json',
              },
            },
          )

          const { accessToken, refreshToken: newRefreshToken } = response.data
          localStorage.setItem('accessToken', accessToken)
          localStorage.setItem('refreshToken', newRefreshToken)
          setAuthToken(accessToken)

          // Update the original request with new token
          originalRequest.headers.Authorization = `Bearer ${accessToken}`
          
          // Retry original request with new token
          return apiClient(originalRequest)
        } catch (refreshError) {
          // Refresh failed, clear tokens and redirect to login
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          setAuthToken(null)
          // Only redirect if we're not already on login page
          if (window.location.hash !== '#/login') {
            window.location.hash = '#/login'
          }
          return Promise.reject(refreshError)
        }
      } else {
        // No refresh token available, redirect to login
        if (window.location.hash !== '#/login') {
          window.location.hash = '#/login'
        }
      }
    }

    return Promise.reject(error)
  },
)

