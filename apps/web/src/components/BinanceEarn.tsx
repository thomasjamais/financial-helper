import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

type EarnProduct = {
  id: string
  asset: string
  name: string
  type: 'flexible' | 'locked' | 'staking' | 'launchpool'
  apr: number
  durationDays?: number
  redeemable: boolean
}

export function BinanceEarn() {
  const [type, setType] = useState<'all' | EarnProduct['type']>('all')
  const { data, isLoading, error } = useQuery({
    queryKey: ['binance', 'earn', 'products'],
    queryFn: async () =>
      (
        await axios.get<EarnProduct[]>(
          '/v1/binance/earn/products',
          { baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8080' },
        )
      ).data,
    retry: false,
    refetchInterval: 60000,
  })

  const filtered = (data || []).filter((p) => (type === 'all' ? true : p.type === type))

  return (
    <div className="space-y-4 bg-slate-900 rounded-lg p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Binance Earn</h2>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as any)}
          className="border border-slate-600 bg-slate-800 text-white p-2 rounded"
        >
          <option value="all">All</option>
          <option value="flexible">Flexible</option>
          <option value="locked">Locked</option>
          <option value="staking">Staking</option>
          <option value="launchpool">Launchpool</option>
        </select>
      </div>

      {isLoading && <p className="text-slate-400">Loading products...</p>}
      {error && <p className="text-red-400">Failed to load products</p>}

      <div className="border rounded-lg overflow-hidden border-slate-700 bg-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700">
              <tr>
                <th className="text-left p-3 text-slate-300">Name</th>
                <th className="text-left p-3 text-slate-300">Asset</th>
                <th className="text-left p-3 text-slate-300">Type</th>
                <th className="text-right p-3 text-slate-300">APR</th>
                <th className="text-right p-3 text-slate-300">Duration</th>
                <th className="text-center p-3 text-slate-300">Redeemable</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-slate-700 hover:bg-slate-800">
                  <td className="p-3 text-white">{p.name}</td>
                  <td className="p-3 text-slate-300">{p.asset}</td>
                  <td className="p-3 text-slate-300 capitalize">{p.type}</td>
                  <td className="p-3 text-right text-slate-300">{(p.apr * 100).toFixed(2)}%</td>
                  <td className="p-3 text-right text-slate-300">{p.durationDays ?? '-'}</td>
                  <td className="p-3 text-center text-slate-300">{p.redeemable ? 'Yes' : 'No'}</td>
                </tr>
              ))}
              {filtered.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-slate-400">
                    No products found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}


