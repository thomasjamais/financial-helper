import { useCurrency } from './CurrencyContext'
import { formatNumber } from '../lib/format'

export default function AssetRow({ a }: { a: {
  asset: string
  amount: number
  priceUSD: number
  priceEUR: number
  valueUSD: number
  valueEUR: number
} }) {
  const { currency } = useCurrency()
  return (
    <tr key={a.asset} className="border-t border-slate-700 hover:bg-slate-800">
      <td className="p-3 font-medium text-white">{a.asset}</td>
      <td className="p-3 text-right text-slate-300">{formatNumber(a.amount, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</td>
      <td className="p-3 text-right text-slate-300">{currency === 'USD' ? '$' : '€'}{formatNumber(currency === 'USD' ? a.priceUSD : a.priceEUR, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</td>
      <td className="p-3 text-right text-slate-300">{currency === 'USD' ? '$' : '€'}{formatNumber(currency === 'USD' ? a.valueUSD : a.valueEUR, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td className="p-3 text-center text-slate-300" />
    </tr>
  )
}
