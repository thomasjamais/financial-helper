import { useEffect, useState } from 'react'
import { useAuth } from '../components/AuthContext'

type User = { id: string; email: string; name: string | null; is_active: boolean; email_verified: boolean }

export default function UsersAdmin() {
  const { accessToken } = useAuth()
  const [users, setUsers] = useState<User[]>([])

  const load = async () => {
    const res = await fetch((import.meta as any).env.VITE_API_URL + '/v1/users', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (res.ok) setUsers(await res.json())
  }

  useEffect(() => { if (accessToken) load() }, [accessToken])

  const toggleActive = async (u: User) => {
    await fetch((import.meta as any).env.VITE_API_URL + `/v1/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ is_active: !u.is_active }),
    })
    load()
  }

  const remove = async (u: User) => {
    await fetch((import.meta as any).env.VITE_API_URL + `/v1/users/${u.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    load()
  }

  return (
    <div className="p-6 bg-slate-800 rounded">
      <h1 className="text-white text-xl mb-4">Users</h1>
      <table className="w-full text-sm">
        <thead className="bg-slate-700 text-slate-300">
          <tr><th className="p-2 text-left">Email</th><th className="p-2">Name</th><th className="p-2">Active</th><th className="p-2">Actions</th></tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id} className="border-t border-slate-700 text-slate-200">
              <td className="p-2">{u.email}</td>
              <td className="p-2">{u.name ?? '-'}</td>
              <td className="p-2 text-center">{u.is_active ? 'Yes' : 'No'}</td>
              <td className="p-2 space-x-2 text-right">
                <button className="px-2 py-1 bg-slate-600 rounded" onClick={() => toggleActive(u)}>{u.is_active ? 'Deactivate' : 'Activate'}</button>
                <button className="px-2 py-1 bg-red-700 rounded" onClick={() => remove(u)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}


