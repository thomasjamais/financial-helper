import { formatNumber } from '../lib/format'

type BacktestMetrics = {
  totalReturnPct: number
  sharpeRatio: number
  maxDrawdown: number
  maxDrawdownPct: number
  winRate: number
  avgTradeDuration: number
  totalTrades: number
  profitableTrades: number
  losingTrades: number
  profitFactor: number
  avgWin: number
  avgLoss: number
  largestWin: number
  largestLoss: number
}

type BacktestResult = {
  aggregated: {
    metrics: BacktestMetrics
    finalEquity: number
    initialBalance: number
  }
  perCrypto: Array<{
    symbol: string
    result: {
      metrics: BacktestMetrics
      finalEquity: number
      initialBalance: number
    }
  }>
}

type BacktestResultsProps = {
  result: BacktestResult
}

export function BacktestResults({ result }: BacktestResultsProps) {
  const { aggregated, perCrypto } = result

  function formatDuration(ms: number): string {
    const days = Math.floor(ms / (1000 * 60 * 60 * 24))
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    if (days > 0) {
      return `${days}d ${hours}h`
    }
    return `${hours}h`
  }

  function MetricCard({ label, value, valueColor }: { label: string; value: string | number; valueColor?: string }) {
    return (
      <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
        <div className="text-sm text-slate-400 mb-1">{label}</div>
        <div className={`text-2xl font-bold ${valueColor || 'text-white'}`}>
          {typeof value === 'number' ? formatNumber(value) : value}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 bg-slate-900 rounded-lg p-6">
      <h3 className="text-2xl font-bold text-white">Backtest Results</h3>

      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h4 className="text-lg font-semibold mb-4 text-white">Aggregated Results</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <MetricCard
            label="Total Return"
            value={`${formatNumber(aggregated.metrics.totalReturnPct)}%`}
            valueColor={aggregated.metrics.totalReturnPct >= 0 ? 'text-green-400' : 'text-red-400'}
          />
          <MetricCard
            label="Final Equity"
            value={`$${formatNumber(aggregated.finalEquity)}`}
            valueColor={aggregated.finalEquity >= aggregated.initialBalance ? 'text-green-400' : 'text-red-400'}
          />
          <MetricCard label="Sharpe Ratio" value={formatNumber(aggregated.metrics.sharpeRatio, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
          <MetricCard
            label="Max Drawdown"
            value={`${formatNumber(aggregated.metrics.maxDrawdownPct)}%`}
            valueColor="text-red-400"
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Win Rate" value={`${formatNumber(aggregated.metrics.winRate)}%`} />
          <MetricCard label="Total Trades" value={aggregated.metrics.totalTrades} />
          <MetricCard label="Profit Factor" value={formatNumber(aggregated.metrics.profitFactor, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
          <MetricCard
            label="Avg Trade Duration"
            value={formatDuration(aggregated.metrics.avgTradeDuration)}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            label="Avg Win"
            value={`$${formatNumber(aggregated.metrics.avgWin)}`}
            valueColor="text-green-400"
          />
          <MetricCard
            label="Avg Loss"
            value={`$${formatNumber(aggregated.metrics.avgLoss)}`}
            valueColor="text-red-400"
          />
          <MetricCard
            label="Largest Win"
            value={`$${formatNumber(aggregated.metrics.largestWin)}`}
            valueColor="text-green-400"
          />
          <MetricCard
            label="Largest Loss"
            value={`$${formatNumber(aggregated.metrics.largestLoss)}`}
            valueColor="text-red-400"
          />
        </div>
      </div>

      {perCrypto.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h4 className="text-lg font-semibold mb-4 text-white">Per-Crypto Results</h4>
          <div className="space-y-4">
            {perCrypto.map(({ symbol, result: cryptoResult }) => (
              <div key={symbol} className="border border-slate-700 rounded-lg p-4 bg-slate-700/50">
                <h5 className="font-semibold mb-2 text-white">{symbol}</h5>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <MetricCard
                    label="Return"
                    value={`${formatNumber(cryptoResult.metrics.totalReturnPct)}%`}
                    valueColor={
                      cryptoResult.metrics.totalReturnPct >= 0 ? 'text-green-400' : 'text-red-400'
                    }
                  />
                  <MetricCard
                    label="Final Equity"
                    value={`$${formatNumber(cryptoResult.finalEquity)}`}
                    valueColor={
                      cryptoResult.finalEquity >= cryptoResult.initialBalance
                        ? 'text-green-400'
                        : 'text-red-400'
                    }
                  />
                  <MetricCard label="Sharpe Ratio" value={formatNumber(cryptoResult.metrics.sharpeRatio, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
                  <MetricCard
                    label="Max Drawdown"
                    value={`${formatNumber(cryptoResult.metrics.maxDrawdownPct)}%`}
                    valueColor="text-red-400"
                  />
                </div>
                <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <MetricCard label="Win Rate" value={`${formatNumber(cryptoResult.metrics.winRate)}%`} />
                  <MetricCard label="Total Trades" value={cryptoResult.metrics.totalTrades} />
                  <MetricCard
                    label="Profit Factor"
                    value={formatNumber(cryptoResult.metrics.profitFactor, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  />
                  <MetricCard
                    label="Avg Trade Duration"
                    value={formatDuration(cryptoResult.metrics.avgTradeDuration)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

