import { useState } from 'react'
import { useCurrency } from './CurrencyContext'
import { formatNumber } from '../lib/format'

type Asset = {
  asset: string
  amount: number
  priceUSD: number
  priceEUR: number
  valueUSD: number
  valueEUR: number
}

export default function AssetTable({ assets }: { assets: Asset[] }) {
  const { currency } = useCurrency()
  const [sortBy, setSortBy] = useState<'asset' | 'amount' | 'price' | 'value'>('value')
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc')

  const sorted = [...assets].sort((a, b) => {
    const priceA = currency === 'USD' ? a.priceUSD : a.priceEUR
    const priceB = currency === 'USD' ? b.priceUSD : b.priceEUR
    const valueA = currency === 'USD' ? a.valueUSD : a.valueEUR
    const valueB = currency === 'USD' ? b.valueUSD : b.valueEUR
    if (sortBy === 'asset') return direction === 'asc' ? a.asset.localeCompare(b.asset) : b.asset.localeCompare(a.asset)
    const map: Record<string, number> = {
      amount: a.amount - b.amount,
      price: priceA - priceB,
      value: valueA - valueB,
    }
    const cmp = map[sortBy]
    return direction === 'asc' ? cmp : -cmp
  })

  return (
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
              <tr key={a.asset} className="border-t border-slate-700 hover:bg-slate-800">
                <td className="p-3 font-medium text-white">{a.asset}</td>
                <td className="p-3 text-right text-slate-300">{formatNumber(a.amount, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</td>
                <td className="p-3 text-right text-slate-300">{currency === 'USD' ? '$' : '€'}{formatNumber(currency === 'USD' ? a.priceUSD : a.priceEUR, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</td>
                <td className="p-3 text-right text-slate-300">{currency === 'USD' ? '$' : '€'}{formatNumber(currency === 'USD' ? a.valueUSD : a.valueEUR, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="p-3 text-center text-slate-300" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


