import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: async () => (await axios.get('/healthz', { baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8080' })).data
  })
}

export default function App() {
  const { data } = useHealth()
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Crypto Dashboard</h1>
      <p className="mt-2 text-sm text-slate-600">API health: {data?.ok ? 'OK' : '...'}</p>
    </div>
  )
}
