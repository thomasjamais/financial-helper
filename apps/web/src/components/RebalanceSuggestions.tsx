type RebalancingSuggestion = {
  asset: string
  currentAllocation: number
  recommendedAllocation: number
  action: 'BUY' | 'SELL' | 'HOLD'
  reason: string
}

export default function RebalanceSuggestions({ suggestions }: { suggestions: RebalancingSuggestion[] }) {
  return (
    <div className="border border-slate-600 rounded p-3 bg-slate-700">
      <div className="font-semibold mb-2 text-white">Suggestions</div>
      <div className="space-y-2">
        {suggestions.map((s) => (
          <div key={s.asset} className="flex justify-between items-center p-2 bg-slate-800 rounded">
            <div>
              <span className="font-medium text-white">{s.asset}</span>
              <span className={`ml-2 px-2 py-1 rounded text-xs ${s.action === 'BUY' ? 'bg-green-700 text-green-200' : s.action === 'SELL' ? 'bg-red-700 text-red-200' : 'bg-slate-600 text-slate-300'}`}>{s.action}</span>
            </div>
            <div className="text-sm text-slate-300">{s.currentAllocation.toFixed(2)}% → {s.recommendedAllocation.toFixed(2)}%</div>
          </div>
        ))}
      </div>
    </div>
  )
}


