interface IndicatorPanelProps {
  title: string
  indicators: Array<{
    name: string
    value: string | number
    label?: string
  }>
}

export function IndicatorPanel({ title, indicators }: IndicatorPanelProps) {
  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <h4 className="text-lg font-semibold text-white mb-3">{title}</h4>
      <div className="space-y-2">
        {indicators.map((indicator, idx) => (
          <div
            key={idx}
            className="flex justify-between items-center py-2 border-b border-slate-700 last:border-0"
          >
            <span className="text-slate-400 text-sm">{indicator.name}</span>
            <div className="text-right">
              <div className="text-white font-semibold">
                {typeof indicator.value === 'number'
                  ? indicator.value.toFixed(4)
                  : indicator.value}
              </div>
              {indicator.label && (
                <div className="text-xs text-slate-500">{indicator.label}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

