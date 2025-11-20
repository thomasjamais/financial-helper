import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { apiClient, setAuthToken } from '../lib/api'

type AuthUser = { id: string; email: string; name?: string | null }

type AuthContextValue = {
  user: AuthUser | null
  accessToken: string | null
  signin: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, name?: string) => Promise<void>
  signout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)

  // Update axios token when accessToken changes
  useEffect(() => {
    setAuthToken(accessToken)
  }, [accessToken])

  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (token) {
      setAccessToken(token)
      setAuthToken(token)
      // restore user from token and normalize URL if on auth routes
      apiClient
        .get('/v1/auth/me')
        .then((res) => {
          const data = res.data
          setUser({ id: data.userId, email: data.email })
          if (location.hash === '#/login' || location.hash === '#/signup') {
            history.replaceState(null, '', '/')
            location.hash = ''
            window.dispatchEvent(new HashChangeEvent('hashchange'))
          }
        })
        .catch(() => {})
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      signin: async (email: string, password: string) => {
        const res = await apiClient.post('/v1/auth/signin', { email, password })
        const data = res.data
        setUser({ id: data.user.id, email: data.user.email, name: data.user.name })
        setAccessToken(data.accessToken)
        localStorage.setItem('accessToken', data.accessToken)
        localStorage.setItem('refreshToken', data.refreshToken)
        setAuthToken(data.accessToken)
        // normalize URL to dashboard root
        history.replaceState(null, '', '/')
        location.hash = ''
        window.dispatchEvent(new HashChangeEvent('hashchange'))
      },
      signup: async (email: string, password: string, name?: string) => {
        await apiClient.post('/v1/auth/signup', { email, password, name })
      },
      signout: async () => {
        const rt = localStorage.getItem('refreshToken')
        try {
          await apiClient.post('/v1/auth/signout', { refreshToken: rt })
        } catch (err) {
          // Ignore errors on signout
        }
        setUser(null)
        setAccessToken(null)
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        setAuthToken(null)
      },
    }),
    [user, accessToken],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}


