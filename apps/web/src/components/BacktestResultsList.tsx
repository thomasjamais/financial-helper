import { useBacktestResults } from '../hooks/useBacktestJobs'
import { BacktestResults } from './BacktestResults'
import { useState } from 'react'

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
}

type BacktestResultsListProps = {
  strategyId: number
}

export function BacktestResultsList({ strategyId }: BacktestResultsListProps) {
  const {
    data: results,
    isLoading,
    error,
  } = useBacktestResults(strategyId, { limit: 20 })
  const [selectedResultId, setSelectedResultId] = useState<number | null>(null)

  if (isLoading) {
    return (
      <div className="p-4 bg-slate-900 rounded-lg">
        <p className="text-slate-400">Loading results...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-900/30 border border-red-600 text-red-300 rounded-lg">
        <p>
          Failed to load results:{' '}
          {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </div>
    )
  }

  if (!results || results.length === 0) {
    return (
      <div className="p-4 bg-slate-900 rounded-lg text-center text-slate-400">
        <p>No backtest results found</p>
      </div>
    )
  }

  const selectedResult = results.find((r) => r.id === selectedResultId)

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <h3 className="text-xl font-bold text-white">Backtest Results</h3>
          <p className="text-sm text-slate-400 mt-1">
            {results.length} result(s)
          </p>
        </div>
        <div className="divide-y divide-slate-700 max-h-96 overflow-y-auto">
          {results.map((result) => (
            <div
              key={result.id}
              className={`p-4 hover:bg-slate-800 transition-colors cursor-pointer ${
                selectedResultId === result.id ? 'bg-slate-800' : ''
              }`}
              onClick={() =>
                setSelectedResultId(
                  result.id === selectedResultId ? null : result.id,
                )
              }
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">
                    Result #{result.id}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Symbols: {result.symbols.join(', ')}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatTimeAgo(new Date(result.created_at))}
                  </p>
                </div>
                <div className="text-right">
                  {result.metrics &&
                  typeof result.metrics === 'object' &&
                  result.metrics !== null &&
                  'totalReturnPct' in result.metrics ? (
                    <p
                      className={`text-sm font-bold ${
                        (result.metrics.totalReturnPct as number) >= 0
                          ? 'text-green-400'
                          : 'text-red-400'
                      }`}
                    >
                      {(result.metrics.totalReturnPct as number).toFixed(2)}%
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedResult &&
      selectedResult.results_json &&
      typeof selectedResult.results_json === 'object' &&
      selectedResult.results_json !== null ? (
        <div className="bg-slate-900 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white">Result Details</h3>
            <button
              onClick={() => setSelectedResultId(null)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              Close
            </button>
          </div>
          <BacktestResults result={selectedResult.results_json as any} />
        </div>
      ) : null}
    </div>
  )
}
