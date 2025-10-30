import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useAuth } from './AuthContext'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

export default function TradeIdeas() {
  const { accessToken } = useAuth()
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['trade-ideas'],
    queryFn: async () =>
      (
        await axios.get(`${API_BASE}/v1/trade-ideas`, {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        })
      ).data as Array<{
        id: number
        exchange: string
        symbol: string
        side: 'BUY'|'SELL'
        score: number
        reason?: string
        created_at: string
      }>,
    enabled: !!accessToken,
    refetchInterval: 60000,
  })

  return (
    <div className="space-y-4 bg-slate-900 rounded-lg p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Trade Ideas</h2>
        <button onClick={() => refetch()} disabled={isFetching} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50">
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      {isLoading && <div className="text-slate-300">Loading…</div>}
      {error && <div className="text-red-400">Failed to load</div>}
      <div className="border rounded-lg overflow-hidden border-slate-700 bg-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700">
              <tr>
                <th className="text-left p-3 text-slate-300">Time</th>
                <th className="text-left p-3 text-slate-300">Exchange</th>
                <th className="text-left p-3 text-slate-300">Symbol</th>
                <th className="text-left p-3 text-slate-300">Side</th>
                <th className="text-right p-3 text-slate-300">Score</th>
                <th className="text-left p-3 text-slate-300">Reason</th>
              </tr>
            </thead>
            <tbody>
              {(data || []).map((s) => (
                <tr key={s.id} className="border-t border-slate-700 hover:bg-slate-800">
                  <td className="p-3 text-slate-300">{new Date(s.created_at).toLocaleString()}</td>
                  <td className="p-3 text-slate-300">{s.exchange}</td>
                  <td className="p-3 text-white">{s.symbol}</td>
                  <td className="p-3 text-slate-300">{s.side}</td>
                  <td className="p-3 text-right text-slate-300">{(s.score*100).toFixed(0)}%</td>
                  <td className="p-3 text-slate-300">{s.reason || '-'}</td>
                </tr>
              ))}
              {(!data || data.length === 0) && !isLoading && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-slate-400">No trade ideas</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}


