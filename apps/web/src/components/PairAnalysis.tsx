import { useState } from 'react'
import { IndicatorPanel } from './IndicatorPanel'
import { EntryExitPanel } from './EntryExitPanel'
import { TradingViewChart } from './TradingViewChart'
import { BacktestPanel } from './BacktestPanel'
import { OrderPlacer } from './OrderPlacer'
import { useScalpingAnalysis } from '../hooks/scalping/useScalpingAnalysis'

export function PairAnalysis({ symbol }: { symbol: string }) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('15')

  const { data, isLoading, error } = useScalpingAnalysis(symbol)

  if (isLoading) {
    return (
      <div className="bg-slate-900 rounded-lg p-6">
        <div className="text-slate-400 text-center py-8">
          Analyzing {symbol}...
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="bg-slate-900 rounded-lg p-6">
        <div className="text-red-400 text-center py-8">
          Failed to analyze {symbol}. Please try again.
        </div>
      </div>
    )
  }

  const fibonacci15m = data.fibonacci['15m']
  const trend1h = data.trend['1h']

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl font-bold text-white">{symbol}</h3>
          <div className="text-slate-400">
            Current Price:{' '}
            <span className="text-white font-semibold">
              {data.currentPrice.toFixed(4)} USDT
            </span>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex gap-2">
            {['1', '5', '15', '60'].map((tf) => (
              <button
                key={tf}
                onClick={() => setSelectedTimeframe(tf)}
                className={`px-4 py-2 rounded ${
                  selectedTimeframe === tf
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {tf}m
              </button>
            ))}
          </div>
        </div>

        <TradingViewChart symbol={symbol} interval={selectedTimeframe} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <IndicatorPanel
            title="Fibonacci Levels (15m)"
            indicators={
              fibonacci15m
                ? [
                    {
                      name: 'Swing High',
                      value: fibonacci15m.swingHigh.toFixed(4),
                    },
                    {
                      name: 'Swing Low',
                      value: fibonacci15m.swingLow.toFixed(4),
                    },
                    {
                      name: '23.6%',
                      value: fibonacci15m.level236.toFixed(4),
                    },
                    {
                      name: '38.2%',
                      value: fibonacci15m.level382.toFixed(4),
                    },
                    {
                      name: '50%',
                      value: fibonacci15m.level500.toFixed(4),
                    },
                    {
                      name: '61.8%',
                      value: fibonacci15m.level618.toFixed(4),
                    },
                    {
                      name: '78.6%',
                      value: fibonacci15m.level786.toFixed(4),
                    },
                  ]
                : [{ name: 'No data', value: 'N/A' }]
            }
          />

          <IndicatorPanel
            title="Trend Analysis (1h)"
            indicators={
              trend1h
                ? [
                    {
                      name: 'Direction',
                      value: trend1h.direction.toUpperCase(),
                      label: `${(trend1h.strength * 100).toFixed(1)}% strength`,
                    },
                    {
                      name: 'EMA 50',
                      value: trend1h.ema50.toFixed(4),
                      label: `${trend1h.priceVsEma50 > 0 ? '+' : ''}${trend1h.priceVsEma50.toFixed(2)}%`,
                    },
                    {
                      name: 'EMA 100',
                      value: trend1h.ema100.toFixed(4),
                      label: `${trend1h.priceVsEma100 > 0 ? '+' : ''}${trend1h.priceVsEma100.toFixed(2)}%`,
                    },
                    {
                      name: 'EMA 200',
                      value: trend1h.ema200.toFixed(4),
                      label: `${trend1h.priceVsEma200 > 0 ? '+' : ''}${trend1h.priceVsEma200.toFixed(2)}%`,
                    },
                  ]
                : [{ name: 'No data', value: 'N/A' }]
            }
          />

          <IndicatorPanel
            title="Support & Resistance"
            indicators={data.supportResistance.slice(0, 5).map((sr) => ({
              name: `${sr.type.toUpperCase()} (${sr.touches} touches)`,
              value: sr.level.toFixed(4),
              label: `${(((sr.level - data.currentPrice) / data.currentPrice) * 100).toFixed(2)}% • Strength: ${(sr.strength * 100).toFixed(0)}%`,
            }))}
          />

          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <h4 className="text-lg font-semibold text-white mb-3">
              Volatility
            </h4>
            <div className="text-white font-semibold text-xl">
              ATR: {data.atr.toFixed(4)}
            </div>
            <div className="text-sm text-slate-400 mt-1">
              {((data.atr / data.currentPrice) * 100).toFixed(2)}% of price
            </div>
          </div>
        </div>

        <EntryExitPanel
          entry={data.recommendedEntry}
          stopLoss={data.stopLoss}
          takeProfits={data.takeProfits}
          currentPrice={data.currentPrice}
        />
      </div>

      <BacktestPanel symbol={symbol} />

      <OrderPlacer symbol={symbol} analysis={data} />
    </div>
  )
}
