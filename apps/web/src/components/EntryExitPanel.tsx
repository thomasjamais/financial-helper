interface EntryExitPanelProps {
  entry: {
    price: number
    side: 'BUY' | 'SELL'
    confidence: number
    reason: string
  } | null
  stopLoss: {
    price: number
    distance: number
    distancePct: number
  } | null
  takeProfits: Array<{
    price: number
    percentage: number
    distance: number
    distancePct: number
  }>
  currentPrice: number
}

export function EntryExitPanel({
  entry,
  stopLoss,
  takeProfits,
  currentPrice,
}: EntryExitPanelProps) {
  if (!entry || !stopLoss) {
    return (
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <div className="text-slate-400 text-center py-4">
          No entry signal available
        </div>
      </div>
    )
  }

  const sideColor = entry.side === 'BUY' ? 'green' : 'red'

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <h4 className="text-lg font-semibold text-white mb-4">
        Entry & Exit Strategy
      </h4>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-slate-400">Recommended Entry</span>
            <span
              className={`font-bold ${entry.side === 'BUY' ? 'text-green-400' : 'text-red-400'}`}
            >
              {entry.side}
            </span>
          </div>
          <div className="bg-slate-900 rounded p-3">
            <div className="text-white font-semibold text-lg">
              {entry.price.toFixed(4)} USDT
            </div>
            <div className="text-sm text-slate-400 mt-1">
              Confidence: {(entry.confidence * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-slate-500 mt-2">{entry.reason}</div>
          </div>
        </div>

        <div>
          <div className="text-slate-400 mb-2">Stop Loss</div>
          <div className="bg-slate-900 rounded p-3">
            <div className="text-red-400 font-semibold">
              {stopLoss.price.toFixed(4)} USDT
            </div>
            <div className="text-sm text-slate-400 mt-1">
              Distance: {stopLoss.distance.toFixed(4)} ({stopLoss.distancePct.toFixed(2)}%)
            </div>
          </div>
        </div>

        <div>
          <div className="text-slate-400 mb-2">Take Profit Levels</div>
          <div className="space-y-2">
            {takeProfits.map((tp, idx) => (
              <div
                key={idx}
                className="bg-slate-900 rounded p-3 flex justify-between items-center"
              >
                <div>
                  <div className="text-green-400 font-semibold">
                    TP{idx + 1}: {tp.price.toFixed(4)} USDT
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {tp.percentage}% of move • {tp.distancePct.toFixed(2)}% from entry
                  </div>
                </div>
                <div className="text-slate-500 text-sm">
                  R:R {idx + 1}:1
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

