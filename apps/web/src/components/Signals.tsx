import { useQuery } from '@tanstack/react-query'
import { useAuth } from './AuthContext'
import { apiClient } from '../lib/api'

export default function Signals() {
  const { accessToken } = useAuth()
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['signals'],
    queryFn: async () =>
      (
        await apiClient.get('/v1/signals')
      ).data as Array<{
        id: number
        source: string
        asset: string
        action: 'BUY'|'SELL'|'HOLD'
        confidence: number
        reason?: string
        created_at: string
      }>,
    enabled: !!accessToken,
  })

  return (
    <div className="space-y-4 bg-slate-900 rounded-lg p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Signals</h2>
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
                <th className="text-left p-3 text-slate-300">Source</th>
                <th className="text-left p-3 text-slate-300">Asset</th>
                <th className="text-left p-3 text-slate-300">Action</th>
                <th className="text-right p-3 text-slate-300">Confidence</th>
                <th className="text-left p-3 text-slate-300">Reason</th>
              </tr>
            </thead>
            <tbody>
              {(data || []).map((s) => (
                <tr key={s.id} className="border-t border-slate-700 hover:bg-slate-800">
                  <td className="p-3 text-slate-300">{new Date(s.created_at).toLocaleString()}</td>
                  <td className="p-3 text-slate-300">{s.source}</td>
                  <td className="p-3 text-white">{s.asset}</td>
                  <td className="p-3 text-slate-300">{s.action}</td>
                  <td className="p-3 text-right text-slate-300">{(s.confidence*100).toFixed(0)}%</td>
                  <td className="p-3 text-slate-300">{s.reason || '-'}</td>
                </tr>
              ))}
              {(!data || data.length === 0) && !isLoading && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-slate-400">No signals</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}


