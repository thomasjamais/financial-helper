import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

type Trade = {
  asset: string
  action: 'BUY' | 'SELL'
  deltaUSD: number
  currentUSD: number
  targetUSD: number
}

export default function AiTrades() {
  const [minUsd, setMinUsd] = useState(5)
  const { mutate, data, isPending } = useMutation({
    mutationFn: async () =>
      (
        await axios.post(`${API_BASE}/v1/binance/ai/spot-trades`, {
          minUsd,
        })
      ).data as { advice: any; trades: Trade[] },
  })

  return (
    <div className="space-y-4 bg-slate-900 rounded-lg p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">AI Trades</h2>
        <div className="flex items-end gap-3">
          <label className="text-sm text-slate-300">
            Min USD
            <div className="text-xs text-slate-400">Hide tiny trades below this USD amount.</div>
            <input
              type="number"
              step="1"
              min="0"
              value={minUsd}
              onChange={(e) => setMinUsd(parseFloat(e.target.value))}
              className="w-28 border border-slate-600 bg-slate-800 text-white p-2 rounded mt-1"
            />
          </label>
          <button
            onClick={() => mutate()}
            disabled={isPending}
            className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded disabled:opacity-50"
            title="Generate suggested spot trades. This does not execute anything."
          >
            {isPending ? 'Generating…' : 'Generate trades'}
          </button>
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-1 gap-4">
          <div className="bg-slate-800 border border-slate-700 rounded">
            <div className="p-3 border-b border-slate-700 text-slate-300">Proposed Trades</div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700">
                  <tr>
                    <th className="text-left p-3 text-slate-300">Asset</th>
                    <th className="text-left p-3 text-slate-300">Action</th>
                    <th className="text-right p-3 text-slate-300">Delta (USD)</th>
                    <th className="text-right p-3 text-slate-300">Current (USD)</th>
                    <th className="text-right p-3 text-slate-300">Target (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.trades || []).map((t) => (
                    <tr key={`${t.asset}-${t.action}`} className="border-t border-slate-700 hover:bg-slate-800">
                      <td className="p-3 text-white">{t.asset}</td>
                      <td className="p-3 text-slate-300">{t.action}</td>
                      <td className="p-3 text-right text-slate-300">{t.deltaUSD.toFixed(2)}</td>
                      <td className="p-3 text-right text-slate-300">{t.currentUSD.toFixed(2)}</td>
                      <td className="p-3 text-right text-slate-300">{t.targetUSD.toFixed(2)}</td>
                    </tr>
                  ))}
                  {(!data.trades || data.trades.length === 0) && (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-400">No trades suggested</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded">
            <div className="p-3 border-b border-slate-700 text-slate-300">AI Summary</div>
            <div className="p-3 text-slate-300 text-sm">
              {data.advice?.summary || 'No summary'} (confidence: {(data.advice?.confidence ?? 0).toFixed(2)})
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


