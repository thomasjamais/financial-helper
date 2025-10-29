import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

type Balance = { asset: string; free: number; locked?: number }

export function BinanceSpotOverview() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['balances', 'binance'],
    queryFn: async () =>
      (
        await axios.get<{ spot: Balance[]; futures: Balance[] }>(
          '/v1/binance/balances',
          { baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8080' },
        )
      ).data,
    retry: false,
    refetchInterval: 30000,
  })

  const spot = data?.spot ?? []
  const totalFree = spot.reduce((sum, b) => sum + Number(b.free || 0), 0)

  return (
    <div className="space-y-4 bg-slate-900 rounded-lg p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Binance Spot Overview</h2>
        <div className="text-sm text-slate-400">Assets: {spot.length}</div>
      </div>

      {isLoading && <p className="text-slate-400">Loading spot balances...</p>}
      {error && <p className="text-red-400">Failed to load spot balances</p>}

      {spot.length > 0 && (
        <>
          <div className="border rounded-lg p-4 bg-slate-800 border-slate-700">
            <div className="text-sm text-slate-300">Total Free (units)</div>
            <div className="text-2xl font-semibold text-white">
              {totalFree.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden border-slate-700 bg-slate-800">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700">
                  <tr>
                    <th className="text-left p-3 text-slate-300">Asset</th>
                    <th className="text-right p-3 text-slate-300">Free</th>
                    <th className="text-right p-3 text-slate-300">Locked</th>
                  </tr>
                </thead>
                <tbody>
                  {spot.map((b) => (
                    <tr
                      key={b.asset}
                      className="border-t border-slate-700 hover:bg-slate-800"
                    >
                      <td className="p-3 font-medium text-white">{b.asset}</td>
                      <td className="p-3 text-right text-slate-300">
                        {Number(b.free).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 8,
                        })}
                      </td>
                      <td className="p-3 text-right text-slate-300">
                        {b.locked
                          ? Number(b.locked).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 8,
                            })
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
