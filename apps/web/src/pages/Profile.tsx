import { useEffect, useState } from 'react'
import { useAuth } from '../components/AuthContext'

export default function Profile() {
  const { accessToken, signout } = useAuth()
  const [me, setMe] = useState<{ userId: string; email: string } | null>(null)

  useEffect(() => {
    const run = async () => {
      const res = await fetch((import.meta as any).env.VITE_API_URL + '/v1/auth/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (res.ok) setMe(await res.json())
    }
    if (accessToken) run()
  }, [accessToken])

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


