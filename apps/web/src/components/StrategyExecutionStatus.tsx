import { useStrategyExecution, useStartExecution, useStopExecution, useStrategyTrades } from '../hooks/useStrategyExecution'
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

type StrategyExecutionStatusProps = {
  strategyId: number
}

export function StrategyExecutionStatus({ strategyId }: StrategyExecutionStatusProps) {
  const { data: execution, isLoading } = useStrategyExecution(strategyId)
  const { data: trades } = useStrategyTrades(strategyId, { limit: 10 })
  const startExecution = useStartExecution()
  const stopExecution = useStopExecution()
  const [showStartDialog, setShowStartDialog] = useState(false)
  const [symbols, setSymbols] = useState<string[]>(['BTCUSDT'])
  const [customSymbol, setCustomSymbol] = useState('')
  const [interval, setInterval] = useState('1h')

  if (isLoading) {
    return (
      <div className="p-4 bg-slate-900 rounded-lg">
        <p className="text-slate-400">Loading execution status...</p>
      </div>
    )
  }

  async function handleStart() {
    if (symbols.length === 0) {
      alert('Please add at least one symbol')
      return
    }
    try {
      await startExecution.mutateAsync({ strategyId, symbols, interval })
      setShowStartDialog(false)
    } catch (error) {
      alert(`Failed to start execution: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async function handleStop() {
    if (confirm('Are you sure you want to stop the strategy execution?')) {
      try {
        await stopExecution.mutateAsync(strategyId)
      } catch (error) {
        alert(`Failed to stop execution: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  function handleAddSymbol() {
    if (customSymbol.trim() && !symbols.includes(customSymbol.trim().toUpperCase())) {
      setSymbols([...symbols, customSymbol.trim().toUpperCase()])
      setCustomSymbol('')
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white">Execution Status</h3>
          {!execution && (
            <button
              onClick={() => setShowStartDialog(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Start Execution
            </button>
          )}
          {execution && (
            <button
              onClick={handleStop}
              disabled={stopExecution.isPending}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {stopExecution.isPending ? 'Stopping...' : 'Stop Execution'}
            </button>
          )}
        </div>

        {!execution ? (
          <div className="text-center py-8 text-slate-400">
            <p>Strategy execution is not active</p>
            <p className="text-sm mt-2">Start execution to begin automatic trading</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800 rounded-lg p-4">
                <p className="text-sm text-slate-400 mb-1">Status</p>
                <p className="text-lg font-bold text-green-400">ACTIVE</p>
              </div>
              <div className="bg-slate-800 rounded-lg p-4">
                <p className="text-sm text-slate-400 mb-1">Interval</p>
                <p className="text-lg font-bold text-white">{execution.interval}</p>
              </div>
              <div className="bg-slate-800 rounded-lg p-4">
                <p className="text-sm text-slate-400 mb-1">Symbols</p>
                <p className="text-lg font-bold text-white">{execution.symbols.join(', ')}</p>
              </div>
              <div className="bg-slate-800 rounded-lg p-4">
                <p className="text-sm text-slate-400 mb-1">Last Execution</p>
                <p className="text-lg font-bold text-white">
                  {execution.last_execution_at ? formatTimeAgo(new Date(execution.last_execution_at)) : 'Never'}
                </p>
              </div>
            </div>
            {execution.next_execution_at && (
              <div className="bg-blue-900/20 border border-blue-600/50 rounded-lg p-4">
                <p className="text-sm text-blue-300">
                  Next execution: {formatTimeAgo(new Date(execution.next_execution_at))}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {showStartDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-lg p-6 max-w-md w-full mx-4 border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">Start Strategy Execution</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Symbols</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={customSymbol}
                    onChange={(e) => setCustomSymbol(e.target.value)}
                    placeholder="Add symbol (e.g., BTCUSDT)"
                    className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleAddSymbol()
                      }
                    }}
                  />
                  <button
                    onClick={handleAddSymbol}
                    className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500"
                  >
                    Add
                  </button>
                </div>
                {symbols.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {symbols.map((symbol) => (
                      <span
                        key={symbol}
                        className="inline-flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded-lg text-sm"
                      >
                        {symbol}
                        <button
                          onClick={() => setSymbols(symbols.filter((s) => s !== symbol))}
                          className="hover:text-red-300"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Interval</label>
                <select
                  value={interval}
                  onChange={(e) => setInterval(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                >
                  <option value="1h">1 hour</option>
                  <option value="4h">4 hours</option>
                  <option value="1d">1 day</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowStartDialog(false)}
                  className="flex-1 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStart}
                  disabled={startExecution.isPending || symbols.length === 0}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {startExecution.isPending ? 'Starting...' : 'Start'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {trades && trades.length > 0 && (
        <div className="bg-slate-900 rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4">Recent Trades</h3>
          <div className="space-y-2">
            {trades.map((trade) => (
              <div
                key={trade.id}
                className="bg-slate-800 rounded-lg p-4 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-white">
                    {trade.symbol} - {trade.signal.toUpperCase()}
                  </p>
                  <p className="text-xs text-slate-400">{formatTimeAgo(new Date(trade.created_at))}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-white">Qty: {trade.quantity.toFixed(4)}</p>
                  {trade.pnl_usd !== null && (
                    <p
                      className={`text-sm font-bold ${
                        trade.pnl_usd >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {trade.pnl_usd >= 0 ? '+' : ''}${trade.pnl_usd.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

