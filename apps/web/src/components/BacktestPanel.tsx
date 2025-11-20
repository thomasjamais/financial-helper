import { useState } from 'react'
import { formatNumber } from '../lib/format'
import {
  useScalpingBacktestMultiplePeriods,
  type BacktestConfig,
  type BacktestResult,
} from '../hooks/scalping/useScalpingBacktest'

export function BacktestPanel({ symbol }: { symbol: string }) {
  const [config, setConfig] = useState<BacktestConfig>({
    initialCapital: 1000,
    leverage: 10,
    riskPerTrade: 0.02,
    maxCapitalPerPair: 500,
    feeRate: 0.001,
    slippageBps: 5,
  })
  const [minConfidence, setMinConfidence] = useState(0.6)
  const [maxOpenPositions, setMaxOpenPositions] = useState(3)

  const backtestMutation = useScalpingBacktestMultiplePeriods()

  const handleConfigChange = (field: keyof BacktestConfig, value: number) => {
    setConfig((prev) => ({ ...prev, [field]: value }))
  }

  const handleRunBacktest = () => {
    backtestMutation.mutate({
      symbol,
      config,
      minConfidence,
      maxOpenPositions,
    })
  }

  const results = backtestMutation.data

  return (
    <div className="bg-slate-900 rounded-lg p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold text-white">
          Backtesting & P&L Estimation
        </h3>
        <button
          onClick={handleRunBacktest}
          disabled={backtestMutation.isPending}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition"
        >
          {backtestMutation.isPending ? 'Running...' : 'Run Backtest'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded p-4 border border-slate-700">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Initial Capital (USDT)
          </label>
          <input
            type="number"
            value={config.initialCapital}
            onChange={(e) =>
              handleConfigChange(
                'initialCapital',
                parseFloat(e.target.value) || 0,
              )
            }
            className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
            min="1"
            step="100"
          />
        </div>

        <div className="bg-slate-800 rounded p-4 border border-slate-700">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Leverage
          </label>
          <input
            type="number"
            value={config.leverage}
            onChange={(e) =>
              handleConfigChange('leverage', parseFloat(e.target.value) || 1)
            }
            className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
            min="1"
            max="125"
            step="1"
          />
        </div>

        <div className="bg-slate-800 rounded p-4 border border-slate-700">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Risk Per Trade (%)
          </label>
          <input
            type="number"
            value={config.riskPerTrade * 100}
            onChange={(e) =>
              handleConfigChange(
                'riskPerTrade',
                (parseFloat(e.target.value) || 0) / 100,
              )
            }
            className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
            min="0"
            max="100"
            step="0.1"
          />
          <div className="text-xs text-slate-400 mt-1">
            {(config.riskPerTrade * 100).toFixed(1)}% of capital per trade
          </div>
        </div>

        <div className="bg-slate-800 rounded p-4 border border-slate-700">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Max Capital Per Pair (USDT)
          </label>
          <input
            type="number"
            value={config.maxCapitalPerPair}
            onChange={(e) =>
              handleConfigChange(
                'maxCapitalPerPair',
                parseFloat(e.target.value) || 0,
              )
            }
            className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
            min="1"
            step="50"
          />
        </div>

        <div className="bg-slate-800 rounded p-4 border border-slate-700">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Min Confidence
          </label>
          <input
            type="number"
            value={minConfidence * 100}
            onChange={(e) =>
              setMinConfidence((parseFloat(e.target.value) || 0) / 100)
            }
            className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
            min="0"
            max="100"
            step="1"
          />
          <div className="text-xs text-slate-400 mt-1">
            {(minConfidence * 100).toFixed(0)}% minimum signal confidence
          </div>
        </div>

        <div className="bg-slate-800 rounded p-4 border border-slate-700">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Max Open Positions
          </label>
          <input
            type="number"
            value={maxOpenPositions}
            onChange={(e) => setMaxOpenPositions(parseInt(e.target.value) || 1)}
            className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
            min="1"
            max="10"
            step="1"
          />
        </div>
      </div>

      {backtestMutation.isPending && (
        <div className="text-center py-8 text-slate-400">
          Running backtest on historical data... This may take a few minutes.
        </div>
      )}

      {backtestMutation.error && (
        <div className="bg-red-900 border border-red-700 rounded p-4 text-red-200">
          Error:{' '}
          {(backtestMutation.error as any)?.response?.data?.error ||
            'Failed to run backtest'}
        </div>
      )}

      {results && (
        <div className="space-y-4">
          <h4 className="text-xl font-bold text-white">Results by Period</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(['30d', '90d', '180d', '1y'] as const).map((period) => {
              const result = results[period]
              const isPositive = result.totalReturnPct >= 0
              return (
                <div
                  key={period}
                  className="bg-slate-800 rounded-lg p-4 border border-slate-700"
                >
                  <div className="text-sm text-slate-400 mb-2">
                    {period.toUpperCase()}
                  </div>
                  <div
                    className={`text-2xl font-bold mb-2 ${
                      isPositive ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {isPositive ? '+' : ''}
                    {formatNumber(result.totalReturnPct, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                    %
                  </div>
                  <div className="text-sm text-slate-300 mb-1">
                    {formatNumber(result.totalReturn, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    USDT
                  </div>
                  <div className="text-xs text-slate-500 space-y-1 mt-2">
                    <div>Trades: {result.totalTrades}</div>
                    <div>
                      Win Rate:{' '}
                      {formatNumber(result.winRate, {
                        maximumFractionDigits: 1,
                      })}
                      %
                    </div>
                    <div>
                      Profit Factor:{' '}
                      {formatNumber(result.profitFactor, {
                        maximumFractionDigits: 2,
                      })}
                    </div>
                    <div>
                      Max DD:{' '}
                      {formatNumber(result.maxDrawdownPct, {
                        maximumFractionDigits: 2,
                      })}
                      %
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
