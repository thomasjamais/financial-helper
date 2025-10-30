import { useCurrency } from './CurrencyContext'
import { SmallPortfolioTable } from './SmallPortfolioTable'

export default function DashboardExchangeCard({ title, assets }: { title: string; assets: any[] }) {
  const { currency } = useCurrency()
  return (
    <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
      <h3 className="text-xl font-bold mb-4">{title}</h3>
      <SmallPortfolioTable assets={assets} currency={currency} />
    </div>
  )
}


