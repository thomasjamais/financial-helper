import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

type Opportunity = {
  id: string
  asset: string
  name: string
  type?: 'flexible' | 'locked' | 'staking' | 'launchpool'
  apr: number
  durationDays?: number
  redeemable: boolean
  score: number
}

export function EarnOpportunities() {
  const [minScore, setMinScore] = useState<string>('0.7')
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['binance', 'earn', 'opportunities', minScore],
    queryFn: async () =>
      (
        await axios.get<Opportunity[]>(
          '/v1/binance/earn/opportunities',
          {
            baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8080',
            params: { minScore },
          },
        )
      ).data,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const list = data || []

  return (
    <div className="space-y-4 bg-slate-900 rounded-lg p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Opportunities</h2>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-400">Min score</label>
          <input
            type="number"
            step="0.05"
            min="0"
            max="1"
            value={minScore}
            onChange={(e) => setMinScore(e.target.value)}
            className="w-24 border border-slate-600 bg-slate-800 text-white p-2 rounded"
          />
          <button
            onClick={() => refetch()
            }
            disabled={isFetching}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
          >
            {isFetching ? 'Refreshing...' : 'Apply'}
          </button>
        </div>
      </div>

      {isLoading && <p className="text-slate-400">Loading...</p>}
      {error && <p className="text-red-400">Failed to load</p>}

      <div className="border rounded-lg overflow-hidden border-slate-700 bg-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700">
              <tr>
                <th className="text-left p-3 text-slate-300">Name</th>
                <th className="text-left p-3 text-slate-300">Asset</th>
                <th className="text-right p-3 text-slate-300">APR</th>
                <th className="text-right p-3 text-slate-300">Duration</th>
                <th className="text-center p-3 text-slate-300">Redeemable</th>
                <th className="text-right p-3 text-slate-300">Score</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="border-t border-slate-700 hover:bg-slate-800">
                  <td className="p-3 text-white">{p.name}</td>
                  <td className="p-3 text-slate-300">{p.asset}</td>
                  <td className="p-3 text-right text-slate-300">{(p.apr * 100).toFixed(2)}%</td>
                  <td className="p-3 text-right text-slate-300">{p.durationDays ?? '-'}</td>
                  <td className="p-3 text-center text-slate-300">{p.redeemable ? 'Yes' : 'No'}</td>
                  <td className="p-3 text-right text-slate-300">{p.score.toFixed(2)}</td>
                </tr>
              ))}
              {list.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-slate-400">No opportunities</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AutoPlanPanel />
    </div>
  )
}

function AutoPlanPanel() {
  const [minApr, setMinApr] = useState(0.03)
  const [totalPct, setTotalPct] = useState(0.5)
  const [maxPerProductPct, setMaxPerProductPct] = useState(0.2)
  const [result, setResult] = useState<any | null>(null)

  return (
    <div className="p-4 bg-slate-800 rounded border border-slate-700">
      <div className="font-semibold text-white mb-2">Auto-Subscribe Plan (dry run)</div>
      <div className="grid grid-cols-3 gap-3 mb-3 text-slate-200">
        <label className="text-sm">Min APR
          <input className="w-full mt-1 p-2 rounded bg-slate-700" type="number" step="0.001" value={minApr} onChange={(e) => setMinApr(parseFloat(e.target.value))} />
        </label>
        <label className="text-sm">Total %
          <input className="w-full mt-1 p-2 rounded bg-slate-700" type="number" step="0.01" value={totalPct} onChange={(e) => setTotalPct(parseFloat(e.target.value))} />
        </label>
        <label className="text-sm">Max/Product %
          <input className="w-full mt-1 p-2 rounded bg-slate-700" type="number" step="0.01" value={maxPerProductPct} onChange={(e) => setMaxPerProductPct(parseFloat(e.target.value))} />
        </label>
      </div>
      <button className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded" onClick={async () => {
        const res = await axios.post((import.meta as any).env.VITE_API_URL + '/v1/binance/earn/auto/plan', { minApr, totalPct, maxPerProductPct })
        setResult(res.data)
      }}>Build plan</button>
      {result && (
        <div className="mt-3 text-slate-300 text-sm">
          <div>Spot Stable: {JSON.stringify(result.spotStable)}</div>
          <div className="mt-2">Plan:</div>
          <ul className="list-disc ml-6">
            {result.plan.map((p: any) => (
              <li key={p.productId}>{p.asset} → {p.amount} (APR {(p.apr*100).toFixed(2)}%)</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}


