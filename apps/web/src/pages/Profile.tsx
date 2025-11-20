import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../components/AuthContext'
import { apiClient } from '../lib/api'

export default function Profile() {
  const { accessToken, signout } = useAuth()
  const { data: me } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await apiClient.get<{ userId: string; email: string }>('/v1/auth/me')
      return res.data
    },
    enabled: !!accessToken,
  })

  return (
    <div className="max-w-lg mx-auto p-6 bg-slate-800 rounded space-y-3">
      <h1 className="text-white text-xl">Profile</h1>
      {me && (
        <div className="text-slate-300">
          <div>User ID: {me.userId}</div>
          <div>Email: {me.email}</div>
        </div>
      )}
      <button className="bg-slate-600 hover:bg-slate-500 text-white px-3 py-2 rounded" onClick={signout}>Sign out</button>
    </div>
  )
}


