import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

export default function Protected({ children }: { children: JSX.Element }) {
  const { accessToken } = useAuth()
  if (!accessToken) return <Navigate to="/login" replace />
  return children
}


