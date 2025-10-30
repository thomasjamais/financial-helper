import { useEffect, useState } from 'react'
import axios from 'axios'
import { useAuth } from './AuthContext'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

export default function TradeDetail({ tradeId }: { tradeId: number }) {
  const { accessToken } = useAuth()
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setLoading(true)
      const res = await axios.get(`${API_BASE}/v1/trades/${tradeId}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      })
      setData(res.data)
      setError(null)
    } catch (e) {
      setError('Failed to load trade')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [tradeId])

  async function snapshot() {
    await axios.post(`${API_BASE}/v1/trades/${tradeId}/snapshot`, {}, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    })
    await load()
  }

  if (loading) return <div className="text-slate-300">Loading…</div>
  if (error) return <div className="text-red-400">{error}</div>
  if (!data) return null

  const t = data.trade
  const history: Array<{ ts: string; mark_price: number; pnl_usd: number }> = data.history || []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xl font-semibold">{t.symbol} {t.side}</div>
        <button onClick={snapshot} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">Record snapshot</button>
      </div>
      <div className="grid grid-cols-2 gap-4 text-slate-300">
        <div>Entry: {Number(t.entry_price).toFixed(6)}</div>
        <div>Qty: {Number(t.quantity).toFixed(6)}</div>
        <div>Budget USD: {Number(t.budget_usd).toFixed(2)}</div>
        <div>TP/SL: {(Number(t.tp_pct)*100).toFixed(1)}% / {(Number(t.sl_pct)*100).toFixed(1)}%</div>
        <div>Status: {t.status}</div>
        <div>Opened: {new Date(t.opened_at).toLocaleString()}</div>
      </div>

      <div className="border rounded-lg overflow-hidden border-slate-700 bg-slate-800">
        <div className="p-3 border-b border-slate-700 text-slate-300">PnL History</div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700">
              <tr>
                <th className="text-left p-3 text-slate-300">Time</th>
                <th className="text-right p-3 text-slate-300">Mark</th>
                <th className="text-right p-3 text-slate-300">PnL USD</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, idx) => (
                <tr key={idx} className="border-t border-slate-700 hover:bg-slate-800">
                  <td className="p-3 text-slate-300">{new Date(h.ts).toLocaleString()}</td>
                  <td className="p-3 text-right text-slate-300">{Number(h.mark_price).toFixed(6)}</td>
                  <td className={`p-3 text-right ${h.pnl_usd >= 0 ? 'text-green-400' : 'text-red-400'}`}>{Number(h.pnl_usd).toFixed(2)}</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-4 text-center text-slate-400">No snapshots</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}


