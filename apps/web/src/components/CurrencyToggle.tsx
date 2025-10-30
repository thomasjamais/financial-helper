import { useCurrency } from './CurrencyContext'

export function CurrencyToggle() {
  const { currency, setCurrency } = useCurrency()
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-slate-400">Currency:</span>
      <button
        onClick={() => setCurrency('USD')}
        className={`px-3 py-1 rounded ${
          currency === 'USD'
            ? 'bg-blue-600 text-white'
            : 'bg-slate-800 text-slate-300'
        }`}
      >
        USD
      </button>
      <button
        onClick={() => setCurrency('EUR')}
        className={`px-3 py-1 rounded ${
          currency === 'EUR'
            ? 'bg-blue-600 text-white'
            : 'bg-slate-800 text-slate-300'
        }`}
      >
        EUR
      </button>
    </div>
  )
}


