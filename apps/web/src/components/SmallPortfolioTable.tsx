import { formatNumber } from '../lib/format'

export function SmallPortfolioTable({ assets, currency }: { assets: any[]; currency: 'USD' | 'EUR' }) {
  return (
    <div className="border rounded-lg overflow-hidden border-slate-700 bg-slate-800">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-700">
            <tr>
              <th className="text-left p-3 text-slate-300">Asset</th>
              <th className="text-right p-3 text-slate-300">Amount</th>
              <th className="text-right p-3 text-slate-300">Price</th>
              <th className="text-right p-3 text-slate-300">Value</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.asset} className="border-t border-slate-700">
                <td className="p-3 text-white">{a.asset}</td>
                <td className="p-3 text-right text-slate-300">
                  {formatNumber(a.amount, { maximumFractionDigits: 6 })}
                </td>
                <td className="p-3 text-right text-slate-300">
                  {currency === 'USD' ? '$' : '€'}
                  {formatNumber(currency === 'USD' ? a.priceUSD : a.priceEUR, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 4,
                  })}
                </td>
                <td className="p-3 text-right text-slate-300">
                  {currency === 'USD' ? '$' : '€'}
                  {formatNumber(currency === 'USD' ? a.valueUSD : a.valueEUR, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


