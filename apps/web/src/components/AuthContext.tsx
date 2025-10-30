import { createContext, useContext, useEffect, useMemo, useState } from 'react'

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

  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (token) {
      setAccessToken(token)
      // restore user from token and normalize URL if on auth routes
      fetch((import.meta as any).env.VITE_API_URL + '/v1/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      }).then(async (res) => {
        if (res.ok) {
          const data = await res.json()
          setUser({ id: data.userId, email: data.email })
          if (location.hash === '#/login' || location.hash === '#/signup') {
            history.replaceState(null, '', '/')
            location.hash = ''
          }
        }
      }).catch(() => {})
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    accessToken,
    signin: async (email: string, password: string) => {
      const res = await fetch((import.meta as any).env.VITE_API_URL + '/v1/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) throw new Error('Signin failed')
      const data = await res.json()
      setUser({ id: data.user.id, email: data.user.email, name: data.user.name })
      setAccessToken(data.accessToken)
      localStorage.setItem('accessToken', data.accessToken)
      localStorage.setItem('refreshToken', data.refreshToken)
      // normalize URL to dashboard root
      history.replaceState(null, '', '/')
      location.hash = ''
    },
    signup: async (email: string, password: string, name?: string) => {
      const res = await fetch((import.meta as any).env.VITE_API_URL + '/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      })
      if (!res.ok) throw new Error('Signup failed')
    },
    signout: async () => {
      const rt = localStorage.getItem('refreshToken')
      await fetch((import.meta as any).env.VITE_API_URL + '/v1/auth/signout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      })
      setUser(null)
      setAccessToken(null)
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
    },
  }), [user, accessToken])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}


