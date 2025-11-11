import { useState } from 'react'
import { useBacktest, type Strategy } from '../hooks/useStrategies'

type BacktestRunnerProps = {
  strategy: Strategy
  onBacktestComplete?: (result: unknown) => void
}

const COMMON_SYMBOLS = [
  'BTCUSDT',
  'ETHUSDT',
  'BNBUSDT',
  'SOLUSDT',
  'ADAUSDT',
  'XRPUSDT',
  'DOGEUSDT',
  'DOTUSDT',
  'MATICUSDT',
  'AVAXUSDT',
]

export function BacktestRunner({ strategy, onBacktestComplete }: BacktestRunnerProps) {
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(['BTCUSDT', 'ETHUSDT'])
  const [customSymbol, setCustomSymbol] = useState('')
  const [interval, setInterval] = useState('1h')
  const [months, setMonths] = useState(6)
  const [initialBalance, setInitialBalance] = useState(strategy.allocated_amount_usd || 1000)
  const backtest = useBacktest()
  const [result, setResult] = useState<unknown | null>(null)

  function handleSymbolToggle(symbol: string) {
    if (selectedSymbols.includes(symbol)) {
      setSelectedSymbols(selectedSymbols.filter((s) => s !== symbol))
    } else {
      setSelectedSymbols([...selectedSymbols, symbol])
    }
  }

  function handleAddCustomSymbol() {
    if (customSymbol.trim() && !selectedSymbols.includes(customSymbol.trim().toUpperCase())) {
      setSelectedSymbols([...selectedSymbols, customSymbol.trim().toUpperCase()])
      setCustomSymbol('')
    }
  }

  async function handleRunBacktest() {
    if (selectedSymbols.length === 0) {
      alert('Please select at least one symbol')
      return
    }

    try {
      const result = await backtest.mutateAsync({
        id: strategy.id,
        input: {
          symbols: selectedSymbols,
          interval,
          months,
          initial_balance: initialBalance,
        },
      })
      setResult(result)
      if (onBacktestComplete) {
        onBacktestComplete(result)
      }
    } catch (error) {
      alert(`Backtest failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  function handleRemoveSymbol(symbol: string) {
    setSelectedSymbols(selectedSymbols.filter((s) => s !== symbol))
  }

  return (
    <div className="space-y-6 bg-slate-900 rounded-lg p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold text-white">Run Backtest</h3>
        <div className="text-sm text-slate-400">
          Strategy: <span className="text-white font-medium">{strategy.name}</span>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <label className="block text-sm font-medium text-slate-300 mb-4">Select Cryptocurrencies</label>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          {COMMON_SYMBOLS.map((symbol) => (
            <label
              key={symbol}
              className={`flex items-center space-x-2 cursor-pointer p-3 rounded-lg border transition-colors ${
                selectedSymbols.includes(symbol)
                  ? 'bg-blue-600/20 border-blue-500'
                  : 'bg-slate-700 border-slate-600 hover:bg-slate-600'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedSymbols.includes(symbol)}
                onChange={() => handleSymbolToggle(symbol)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-white font-medium">{symbol}</span>
            </label>
          ))}
        </div>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={customSymbol}
            onChange={(e) => setCustomSymbol(e.target.value)}
            placeholder="Add custom symbol (e.g., SOLUSDT)"
            className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleAddCustomSymbol()
              }
            }}
          />
          <button
            onClick={handleAddCustomSymbol}
            className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500 transition-colors"
          >
            Add
          </button>
        </div>

        {selectedSymbols.length > 0 && (
          <div className="mt-4 p-4 bg-slate-700 rounded-lg">
            <p className="text-sm font-medium text-slate-300 mb-2">Selected Cryptocurrencies ({selectedSymbols.length}):</p>
            <div className="flex flex-wrap gap-2">
              {selectedSymbols.map((symbol) => (
                <span
                  key={symbol}
                  className="inline-flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded-lg text-sm"
                >
                  {symbol}
                  <button
                    onClick={() => handleRemoveSymbol(symbol)}
                    className="hover:text-red-300 transition-colors"
                    aria-label={`Remove ${symbol}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <label className="block text-sm font-medium text-slate-300 mb-2">Time Interval</label>
          <select
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          >
            <option value="1m">1 minute</option>
            <option value="5m">5 minutes</option>
            <option value="15m">15 minutes</option>
            <option value="1h">1 hour</option>
            <option value="4h">4 hours</option>
            <option value="1d">1 day</option>
          </select>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <label className="block text-sm font-medium text-slate-300 mb-2">Historical Period</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={months}
              onChange={(e) => setMonths(Number.parseInt(e.target.value) || 6)}
              min="1"
              max="12"
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
            <span className="text-slate-300 whitespace-nowrap">months</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">Default: 6 months</p>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <label className="block text-sm font-medium text-slate-300 mb-2">Initial Balance (USD)</label>
          <input
            type="number"
            value={initialBalance}
            onChange={(e) => setInitialBalance(Number.parseFloat(e.target.value) || 0)}
            min="0"
            step="0.01"
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleRunBacktest}
          disabled={backtest.isPending || selectedSymbols.length === 0}
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-lg"
        >
          {backtest.isPending ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">⏳</span>
              Running Backtest...
            </span>
          ) : (
            'Run Backtest'
          )}
        </button>
      </div>

      {backtest.isError && (
        <div className="p-4 bg-red-900/30 border border-red-600 text-red-300 rounded-lg">
          <p className="font-medium mb-1">Backtest Failed</p>
          <p className="text-sm">{backtest.error instanceof Error ? backtest.error.message : 'An unknown error occurred'}</p>
        </div>
      )}

      {backtest.isPending && (
        <div className="p-4 bg-blue-900/30 border border-blue-600 text-blue-300 rounded-lg">
          <p className="font-medium">Running backtest...</p>
          <p className="text-sm mt-1">This may take a few moments. Please wait.</p>
        </div>
      )}
    </div>
  )
}

