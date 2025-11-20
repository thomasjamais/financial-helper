import { useState } from 'react'
import { formatNumber } from '../lib/format'
import type { ScalpingAnalysis } from '../types/scalping'
import { usePlaceScalpingOrder } from '../hooks/scalping/usePlaceScalpingOrder'

interface OrderPlacerProps {
  symbol: string
  analysis: ScalpingAnalysis | null
}

export function OrderPlacer({ symbol, analysis }: OrderPlacerProps) {
  const [capital, setCapital] = useState(1000)
  const [leverage, setLeverage] = useState(10)
  const [simulation, setSimulation] = useState(true)

  const placeOrderMutation = usePlaceScalpingOrder()

  const handlePlaceOrder = () => {
    if (!analysis) {
      alert('Please wait for analysis to complete')
      return
    }

    if (!simulation) {
      const confirmed = confirm(
        `Are you sure you want to place a REAL order for ${symbol}?\n\nThis will use real funds!`,
      )
      if (!confirmed) {
        return
      }
    }

    placeOrderMutation.mutate({
      symbol,
      capital,
      leverage,
      analysis,
      simulation,
    })
  }

  if (!analysis) {
    return (
      <div className="bg-slate-900 rounded-lg p-6">
        <div className="text-slate-400 text-center py-4">
          Waiting for analysis...
        </div>
      </div>
    )
  }

  if (!analysis.recommendedEntry || !analysis.stopLoss) {
    return (
      <div className="bg-slate-900 rounded-lg p-6">
        <div className="text-slate-400 text-center py-4">
          No entry signal available for {symbol}
        </div>
      </div>
    )
  }

  const orderResult = placeOrderMutation.data

  return (
    <div className="bg-slate-900 rounded-lg p-6 space-y-4">
      <h3 className="text-xl font-bold text-white">Place Order</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800 rounded p-4 border border-slate-700">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Capital to Allocate (USDT)
          </label>
          <input
            type="number"
            value={capital}
            onChange={(e) => setCapital(parseFloat(e.target.value) || 0)}
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
            value={leverage}
            onChange={(e) => setLeverage(parseFloat(e.target.value) || 1)}
            className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
            min="1"
            max="125"
            step="1"
          />
        </div>
      </div>

      <div className="bg-slate-800 rounded p-4 border border-slate-700">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={simulation}
            onChange={(e) => setSimulation(e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500"
          />
          <span className="text-slate-300">
            Simulation Mode (default: checked)
          </span>
        </label>
        <div className="text-xs text-slate-500 mt-1 ml-6">
          {simulation
            ? 'Order will be simulated, no real funds will be used'
            : '⚠️ REAL ORDER: Real funds will be used!'}
        </div>
      </div>

      <button
        onClick={handlePlaceOrder}
        disabled={placeOrderMutation.isPending || capital <= 0 || leverage <= 0}
        className={`w-full px-6 py-3 rounded-lg font-semibold transition ${
          simulation
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-red-600 hover:bg-red-700 text-white'
        } disabled:opacity-50`}
      >
        {placeOrderMutation.isPending
          ? 'Processing...'
          : simulation
            ? 'Simulate Order'
            : 'Place Real Order'}
      </button>

      {placeOrderMutation.error && (
        <div className="bg-red-900 border border-red-700 rounded p-4 text-red-200">
          Error:{' '}
          {(placeOrderMutation.error as any)?.response?.data?.error ||
            'Failed to place order'}
        </div>
      )}

      {orderResult && (
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-lg font-semibold text-white">Order Details</h4>
            <span
              className={`px-3 py-1 rounded text-sm ${
                orderResult.result.simulation
                  ? 'bg-blue-600 text-white'
                  : 'bg-green-600 text-white'
              }`}
            >
              {orderResult.result.simulation ? 'SIMULATED' : 'REAL ORDER'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-slate-400">Side</div>
              <div
                className={`font-semibold ${
                  orderResult.order.side === 'BUY'
                    ? 'text-green-400'
                    : 'text-red-400'
                }`}
              >
                {orderResult.order.side}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-400">Entry Price</div>
              <div className="text-white font-semibold">
                {formatNumber(orderResult.order.entryPrice, {
                  minimumFractionDigits: 4,
                  maximumFractionDigits: 4,
                })}{' '}
                USDT
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-400">Quantity</div>
              <div className="text-white font-semibold">
                {formatNumber(orderResult.order.quantity, {
                  minimumFractionDigits: 4,
                  maximumFractionDigits: 4,
                })}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-400">Position Size</div>
              <div className="text-white font-semibold">
                {formatNumber(orderResult.order.positionSize, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                USDT
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-400">Stop Loss</div>
              <div className="text-red-400 font-semibold">
                {formatNumber(orderResult.order.stopLoss, {
                  minimumFractionDigits: 4,
                  maximumFractionDigits: 4,
                })}{' '}
                USDT
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-400">Risk Amount</div>
              <div className="text-white font-semibold">
                {formatNumber(orderResult.order.riskAmount, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                USDT (
                {formatNumber(orderResult.order.riskPct, {
                  maximumFractionDigits: 2,
                })}
                %)
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-400">Max Loss</div>
              <div className="text-red-400 font-semibold">
                {formatNumber(orderResult.order.maxLoss, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                USDT (
                {formatNumber(orderResult.order.maxLossPct, {
                  maximumFractionDigits: 2,
                })}
                %)
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-400">Risk:Reward</div>
              <div className="text-white font-semibold">
                1:
                {formatNumber(orderResult.order.riskRewardRatio, {
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
          </div>

          <div>
            <div className="text-sm text-slate-400 mb-2">
              Take Profit Levels
            </div>
            <div className="space-y-2">
              {orderResult.order.takeProfits.map((tp, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center p-2 bg-slate-900 rounded"
                >
                  <span className="text-green-400 font-semibold">
                    TP{idx + 1}:{' '}
                    {formatNumber(tp.price, {
                      minimumFractionDigits: 4,
                      maximumFractionDigits: 4,
                    })}{' '}
                    USDT
                  </span>
                  <span className="text-slate-400 text-sm">
                    {tp.percentage}% of move
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-700">
            <div className="text-sm text-slate-400 mb-1">Order ID</div>
            <div className="text-white font-mono text-sm">
              {orderResult.result.orderId}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
