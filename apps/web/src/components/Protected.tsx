import { useEffect } from 'react'
import { useAuth } from './AuthContext'

export default function Protected({ children }: { children: JSX.Element }) {
  const { accessToken } = useAuth()
  useEffect(() => {
    if (!accessToken) {
      if (location.hash !== '#/login') {
        location.hash = '#/login'
      }
    }
  }, [accessToken])
  if (!accessToken) return null
  return children
}


