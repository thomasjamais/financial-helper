import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useAuth } from './AuthContext'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

type Trade = {
  id: number
  symbol: string
  side: 'BUY'|'SELL'
  budget_usd: number
  quantity: number
  entry_price: number
  tp_pct: number
  sl_pct: number
  status: string
  opened_at: string
  pnl_unrealized?: number | null
  markPrice?: number | null
}

export default function Trades() {
  const { accessToken } = useAuth()
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['trades-with-pnl'],
    queryFn: async () => (
      await axios.get(`${API_BASE}/v1/trades/with-pnl`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      })
    ).data as Trade[],
    enabled: !!accessToken,
    refetchInterval: 30000,
  })

  return (
    <div className="space-y-4 bg-slate-900 rounded-lg p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Trades</h2>
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
                <th className="text-left p-3 text-slate-300">Symbol</th>
                <th className="text-left p-3 text-slate-300">Side</th>
                <th className="text-right p-3 text-slate-300">Entry</th>
                <th className="text-right p-3 text-slate-300">Mark</th>
                <th className="text-right p-3 text-slate-300">Qty</th>
                <th className="text-right p-3 text-slate-300">Budget USD</th>
                <th className="text-right p-3 text-slate-300">TP/SL</th>
                <th className="text-right p-3 text-slate-300">Unrealized PnL</th>
                <th className="text-left p-3 text-slate-300">Status</th>
              </tr>
            </thead>
            <tbody>
              {(data || []).map((t) => (
                <tr key={t.id} className="border-t border-slate-700 hover:bg-slate-800">
                  <td className="p-3 text-slate-300">{new Date(t.opened_at).toLocaleString()}</td>
                  <td className="p-3 text-white">{t.symbol}</td>
                  <td className="p-3 text-slate-300">{t.side}</td>
                  <td className="p-3 text-right text-slate-300">{t.entry_price.toFixed(6)}</td>
                  <td className="p-3 text-right text-slate-300">{(t.markPrice ?? 0).toFixed(6)}</td>
                  <td className="p-3 text-right text-slate-300">{t.quantity.toFixed(6)}</td>
                  <td className="p-3 text-right text-slate-300">{t.budget_usd.toFixed(2)}</td>
                  <td className="p-3 text-right text-slate-300">{(t.tp_pct*100).toFixed(1)}% / {(t.sl_pct*100).toFixed(1)}%</td>
                  <td className={`p-3 text-right ${((t.pnl_unrealized ?? 0) >= 0) ? 'text-green-400' : 'text-red-400'}`}>{(t.pnl_unrealized ?? 0).toFixed(2)}</td>
                  <td className="p-3 text-slate-300">{t.status}</td>
                </tr>
              ))}
              {(!data || data.length === 0) && !isLoading && (
                <tr>
                  <td colSpan={10} className="p-4 text-center text-slate-400">No trades</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}


