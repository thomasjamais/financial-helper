import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import axios from 'axios'
import { useCurrency } from './CurrencyContext'

type Portfolio = {
  assets: { asset: string; amount: number; priceUSD: number; priceEUR: number; valueUSD: number; valueEUR: number }[]
  totalValueUSD: number
  totalValueEUR: number
}

export function BinanceSpotOverview() {
  const { currency } = useCurrency()
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
  const [sortBy, setSortBy] = useState<'asset' | 'amount' | 'price' | 'value'>('value')
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc')

  const sorted = [...assets].sort((a, b) => {
    const priceA = currency === 'USD' ? a.priceUSD : a.priceEUR
    const priceB = currency === 'USD' ? b.priceUSD : b.priceEUR
    const valueA = currency === 'USD' ? a.valueUSD : a.valueEUR
    const valueB = currency === 'USD' ? b.valueUSD : b.valueEUR
    let av = 0
    let bv = 0
    if (sortBy === 'asset') { av = a.asset.localeCompare(b.asset); bv = 0 } else if (sortBy === 'amount') { av = a.amount; bv = b.amount } else if (sortBy === 'price') { av = priceA; bv = priceB } else { av = valueA; bv = valueB }
    const cmp = sortBy === 'asset' ? av : av - bv
    return direction === 'asc' ? cmp : -cmp
  })

  const totalValue = currency === 'USD' ? data?.totalValueUSD : data?.totalValueEUR

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
                    <th className="text-left p-3 text-slate-300 cursor-pointer" onClick={() => setSortBy('asset')}>Asset</th>
                    <th className="text-right p-3 text-slate-300 cursor-pointer" onClick={() => setSortBy('amount')}>Amount</th>
                    <th className="text-right p-3 text-slate-300 cursor-pointer" onClick={() => setSortBy('price')}>Price ({currency})</th>
                    <th className="text-right p-3 text-slate-300 cursor-pointer" onClick={() => setSortBy('value')}>Value ({currency})</th>
                    <th className="text-center p-3 text-slate-300">
                      <button
                        className="px-2 py-1 bg-slate-600 rounded text-xs"
                        onClick={() => setDirection(direction === 'asc' ? 'desc' : 'asc')}
                      >
                        {direction === 'asc' ? 'Asc' : 'Desc'}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((a) => (
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
                      <td className="p-3 text-right text-slate-300">{currency === 'USD' ? '$' : '€'}{(currency === 'USD' ? a.priceUSD : a.priceEUR).toFixed(4)}</td>
                      <td className="p-3 text-right text-slate-300">{currency === 'USD' ? '$' : '€'}{(currency === 'USD' ? a.valueUSD : a.valueEUR).toFixed(2)}</td>
                      <td className="p-3 text-center text-slate-300" />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="text-right text-slate-300">
            Total: {currency === 'USD' ? '$' : '€'}{(totalValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </>
      )}
    </div>
  )
}
