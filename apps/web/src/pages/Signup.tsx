import { useState } from 'react'
import { useAuth } from '../components/AuthContext'

export default function Signup() {
  const { signup } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  return (
    <div className="max-w-sm mx-auto p-6 bg-slate-800 rounded">
      <h1 className="text-white text-xl mb-4">Sign up</h1>
      {error && <div className="text-red-400 mb-2">{error}</div>}
      {done && <div className="text-green-400 mb-2">Account created. You can login now.</div>}
      <input className="w-full mb-2 p-2 rounded bg-slate-700 text-white" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="w-full mb-2 p-2 rounded bg-slate-700 text-white" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className="w-full mb-4 p-2 rounded bg-slate-700 text-white" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button className="w-full bg-purple-600 hover:bg-purple-700 text-white p-2 rounded" onClick={async () => {
        setError(null)
        try { await signup(email, password, name); setDone(true) } catch (e) { setError('Signup failed') }
      }}>Create account</button>
    </div>
  )
}


