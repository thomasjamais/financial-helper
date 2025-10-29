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
            onClick={() => refetch()}
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
    </div>
  )
}


