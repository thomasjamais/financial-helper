import { useCurrency } from './CurrencyContext'
import { formatNumber } from '../lib/format'

export default function AssetTableTotals({ totalUSD, totalEUR }: { totalUSD: number; totalEUR: number }) {
  const { currency } = useCurrency()
  const total = currency === 'USD' ? totalUSD : totalEUR
  return (
    <div className="text-right text-slate-300">
      Total: {currency === 'USD' ? '$' : '€'}
      {formatNumber(total ?? 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </div>
  )
}


