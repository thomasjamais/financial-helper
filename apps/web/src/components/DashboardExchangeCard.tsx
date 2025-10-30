import { useCurrency } from './CurrencyContext'
import { SmallPortfolioTable } from './SmallPortfolioTable'

export default function DashboardExchangeCard({ title, assets, tooltip }: { title: string; assets: any[]; tooltip?: string }) {
  const { currency } = useCurrency()
  return (
    <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
      <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
        <span>{title}</span>
        {tooltip && (
          <span className="inline-flex items-center justify-center w-4 h-4 text-xs rounded-full bg-slate-700 cursor-help" title={tooltip}>i</span>
        )}
      </h3>
      <SmallPortfolioTable assets={assets} currency={currency} />
    </div>
  )
}


