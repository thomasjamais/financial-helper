import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

type Portfolio = {
  assets: { asset: string; amount: number; priceUSD: number; valueUSD: number }[]
  totalValueUSD: number
}

export function BinanceSpotOverview() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['portfolio', 'binance', 'spot'],
    queryFn: async () =>
      (
        await axios.get<Portfolio>('/v1/binance/portfolio/spot', {
          baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8080',
        })
      ).data,
    retry: false,
    refetchInterval: 30000,
  })

  const assets = data?.assets ?? []

  return (
    <div className="space-y-4 bg-slate-900 rounded-lg p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Binance Spot Overview</h2>
        <div className="text-sm text-slate-400">Assets: {assets.length}</div>
      </div>

      {isLoading && <p className="text-slate-400">Loading spot portfolio...</p>}
      {error && <p className="text-red-400">Failed to load spot portfolio</p>}

      {assets.length > 0 && (
        <>
          <div className="border rounded-lg overflow-hidden border-slate-700 bg-slate-800">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700">
                  <tr>
                    <th className="text-left p-3 text-slate-300">Asset</th>
                    <th className="text-right p-3 text-slate-300">Amount</th>
                    <th className="text-right p-3 text-slate-300">Price (USD)</th>
                    <th className="text-right p-3 text-slate-300">Value (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a) => (
                    <tr
                      key={a.asset}
                      className="border-t border-slate-700 hover:bg-slate-800"
                    >
                      <td className="p-3 font-medium text-white">{a.asset}</td>
                      <td className="p-3 text-right text-slate-300">
                        {Number(a.amount).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 8,
                        })}
                      </td>
                      <td className="p-3 text-right text-slate-300">${a.priceUSD.toFixed(4)}</td>
                      <td className="p-3 text-right text-slate-300">${a.valueUSD.toFixed(2)}</td>
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
