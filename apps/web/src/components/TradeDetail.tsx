import { useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { formatPrice, formatQuantity, formatCurrency } from '../lib/numberFormat'
import { useTradeDetail, useCreateTradeFeeling, useUpdateTradeFeeling } from '../hooks/useTradeDetail'
import { apiClient } from '../lib/api'

const TIMEFRAMES: Array<'1min' | '5min' | '30min' | '1h' | '4h' | '1d' | '1w' | '1m' | '1y'> = [
  '1min',
  '5min',
  '30min',
  '1h',
  '4h',
  '1d',
  '1w',
  '1m',
  '1y',
]

export default function TradeDetail({ tradeId }: { tradeId: number }) {
  const { accessToken } = useAuth()
  const { data, isLoading, error, refetch } = useTradeDetail(tradeId)
  const createFeeling = useCreateTradeFeeling()
  const updateFeeling = useUpdateTradeFeeling()
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1min' | '5min' | '30min' | '1h' | '4h' | '1d' | '1w' | '1m' | '1y'>('1h')
  const [feelingText, setFeelingText] = useState('')
  const [sentimentScore, setSentimentScore] = useState(0)
  const [editingFeelingId, setEditingFeelingId] = useState<number | null>(null)

  useEffect(() => {
    if (data) {
      const feeling = data.feelings.find((f) => f.timeframe === selectedTimeframe)
      if (feeling) {
        setFeelingText(feeling.feeling_text || '')
        setSentimentScore(feeling.sentiment_score || 0)
        setEditingFeelingId(feeling.id)
      } else {
        setFeelingText('')
        setSentimentScore(0)
        setEditingFeelingId(null)
      }
    }
  }, [data, selectedTimeframe])

  async function snapshot() {
    await apiClient.post(`/v1/trades/${tradeId}/snapshot`, {})
    await refetch()
  }

  async function saveFeeling() {
    try {
      if (editingFeelingId) {
        await updateFeeling.mutateAsync({
          tradeId,
          feelingId: editingFeelingId,
          input: {
            feeling_text: feelingText || null,
            sentiment_score: sentimentScore,
          },
        })
      } else {
        await createFeeling.mutateAsync({
          tradeId,
          input: {
            feeling_text: feelingText || null,
            sentiment_score: sentimentScore,
            timeframe: selectedTimeframe,
          },
        })
      }
      await refetch()
    } catch (error) {
      alert(`Failed to save feeling: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  if (isLoading) return <div className="text-slate-300">Loading…</div>
  if (error) return <div className="text-red-400">Failed to load trade</div>
  if (!data) return null

  const t = data.trade
  const history = data.history || []

  // Calculate distances
  const entryPrice = Number(t.entry_price)
  const currentPrice = data.currentMarkPrice || entryPrice
  const tpPrice = data.tpPrice
  const slPrice = data.slPrice

  let distanceToTp: number | null = null
  let distanceToSl: number | null = null
  let distanceToTpPct: number | null = null
  let distanceToSlPct: number | null = null

  if (tpPrice && slPrice) {
    if (t.side === 'BUY') {
      distanceToTp = tpPrice - currentPrice
      distanceToSl = currentPrice - slPrice
      distanceToTpPct = ((tpPrice - currentPrice) / currentPrice) * 100
      distanceToSlPct = ((currentPrice - slPrice) / currentPrice) * 100
    } else {
      distanceToTp = currentPrice - tpPrice
      distanceToSl = slPrice - currentPrice
      distanceToTpPct = ((currentPrice - tpPrice) / currentPrice) * 100
      distanceToSlPct = ((slPrice - currentPrice) / currentPrice) * 100
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={() => {
            window.location.hash = '#/trades'
          }}
          className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm"
        >
          ← Back to Trades
        </button>
      </div>
      <div className="space-y-6 bg-slate-900 rounded-lg p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">
              {t.symbol} {t.side}
            </h2>
            <div className="text-sm text-slate-400 mt-1">
              Status: <span className="text-slate-300">{t.status}</span> | Opened:{' '}
              {new Date(t.opened_at || '').toLocaleString()}
            </div>
          </div>
          <button
            onClick={snapshot}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
          >
            Record Snapshot
          </button>
        </div>

        {/* Trade Info Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-400 mb-1">Entry Price</div>
          <div className="text-lg font-mono text-white">{formatPrice(entryPrice)}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-400 mb-1">Current Price</div>
          <div className="text-lg font-mono text-white">
            {data.currentMarkPrice ? formatPrice(data.currentMarkPrice) : '-'}
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-400 mb-1">Quantity</div>
          <div className="text-lg font-mono text-white">{formatQuantity(Number(t.quantity))}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-400 mb-1">Budget USD</div>
          <div className="text-lg font-mono text-white">{formatCurrency(Number(t.budget_usd))}</div>
        </div>
      </div>

      {/* TP/SL Section */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Take Profit / Stop Loss</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-900/30 border border-green-600 rounded-lg p-4">
            <div className="text-xs text-green-400 mb-1">Take Profit</div>
            <div className="text-xl font-mono text-green-300 mb-2">
              {tpPrice ? formatPrice(tpPrice) : '-'}
            </div>
            {distanceToTp !== null && (
              <div className="text-sm text-green-400">
                {distanceToTp > 0 ? '+' : ''}
                {formatPrice(Math.abs(distanceToTp))} (
                {distanceToTpPct !== null ? `${distanceToTpPct > 0 ? '+' : ''}${distanceToTpPct.toFixed(2)}%` : '-'})
              </div>
            )}
          </div>
          <div className="bg-red-900/30 border border-red-600 rounded-lg p-4">
            <div className="text-xs text-red-400 mb-1">Stop Loss</div>
            <div className="text-xl font-mono text-red-300 mb-2">
              {slPrice ? formatPrice(slPrice) : '-'}
            </div>
            {distanceToSl !== null && (
              <div className="text-sm text-red-400">
                {distanceToSl > 0 ? '+' : ''}
                {formatPrice(Math.abs(distanceToSl))} (
                {distanceToSlPct !== null ? `${distanceToSlPct > 0 ? '+' : ''}${distanceToSlPct.toFixed(2)}%` : '-'})
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Simulation Section */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Simulation & Analysis</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-700 rounded-lg p-4">
            <div className="text-xs text-slate-400 mb-1">Expected Gain at TP</div>
            <div className={`text-lg font-semibold ${data.expectedPnLAtTp && data.expectedPnLAtTp >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {data.expectedPnLAtTp !== null ? formatCurrency(data.expectedPnLAtTp) : '-'}
            </div>
            {data.expectedPnLAtTp !== null && t.budget_usd > 0 && (
              <div className="text-xs text-slate-400 mt-1">
                {((data.expectedPnLAtTp / t.budget_usd) * 100).toFixed(2)}%
              </div>
            )}
          </div>
          <div className="bg-slate-700 rounded-lg p-4">
            <div className="text-xs text-slate-400 mb-1">Expected Loss at SL</div>
            <div className={`text-lg font-semibold ${data.expectedPnLAtSl && data.expectedPnLAtSl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {data.expectedPnLAtSl !== null ? formatCurrency(data.expectedPnLAtSl) : '-'}
            </div>
            {data.expectedPnLAtSl !== null && t.budget_usd > 0 && (
              <div className="text-xs text-slate-400 mt-1">
                {((data.expectedPnLAtSl / t.budget_usd) * 100).toFixed(2)}%
              </div>
            )}
          </div>
          <div className="bg-slate-700 rounded-lg p-4">
            <div className="text-xs text-slate-400 mb-1">Current Unrealized PnL</div>
            <div className={`text-lg font-semibold ${data.currentUnrealizedPnL && data.currentUnrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {data.currentUnrealizedPnL !== null ? formatCurrency(data.currentUnrealizedPnL) : '-'}
            </div>
            {data.currentUnrealizedPnL !== null && t.budget_usd > 0 && (
              <div className="text-xs text-slate-400 mt-1">
                {((data.currentUnrealizedPnL / t.budget_usd) * 100).toFixed(2)}%
              </div>
            )}
          </div>
          <div className="bg-slate-700 rounded-lg p-4">
            <div className="text-xs text-slate-400 mb-1">Risk/Reward Ratio</div>
            <div className="text-lg font-semibold text-white">
              {data.riskRewardRatio !== null ? data.riskRewardRatio.toFixed(2) : '-'}
            </div>
            {data.probabilityEstimate !== null && (
              <div className="text-xs text-slate-400 mt-1">
                Probability: {(data.probabilityEstimate * 100).toFixed(1)}%
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Feelings Tracking Section */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Trade Feelings</h3>
        <div className="space-y-4">
          {/* Timeframe Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Timeframe
            </label>
            <div className="flex flex-wrap gap-2">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setSelectedTimeframe(tf)}
                  className={`px-3 py-1 rounded text-sm ${
                    selectedTimeframe === tf
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          {/* Sentiment Score */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Sentiment Score: {sentimentScore.toFixed(2)} ({sentimentScore >= 0.5 ? 'Very Positive' : sentimentScore >= 0 ? 'Positive' : sentimentScore >= -0.5 ? 'Negative' : 'Very Negative'})
            </label>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.01"
              value={sentimentScore}
              onChange={(e) => setSentimentScore(Number.parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>Very Negative (-1)</span>
              <span>Neutral (0)</span>
              <span>Very Positive (+1)</span>
            </div>
          </div>

          {/* Feeling Text */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Notes
            </label>
            <textarea
              value={feelingText}
              onChange={(e) => setFeelingText(e.target.value)}
              placeholder="Enter your thoughts about this trade..."
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
            />
          </div>

          {/* Save Button */}
          <button
            onClick={saveFeeling}
            disabled={createFeeling.isPending || updateFeeling.isPending}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
          >
            {createFeeling.isPending || updateFeeling.isPending
              ? 'Saving...'
              : editingFeelingId
                ? 'Update Feeling'
                : 'Save Feeling'}
          </button>

          {/* Feelings History */}
          {data.feelings.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-slate-300 mb-2">Feelings History</h4>
              <div className="space-y-2">
                {data.feelings.map((feeling) => (
                  <div
                    key={feeling.id}
                    className="bg-slate-700 rounded p-3 text-sm"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-slate-300 font-medium">{feeling.timeframe}</span>
                      <span className="text-slate-400 text-xs">
                        {new Date(feeling.created_at).toLocaleString()}
                      </span>
                    </div>
                    {feeling.sentiment_score !== null && (
                      <div className="text-slate-300 mb-1">
                        Sentiment: {feeling.sentiment_score.toFixed(2)}
                      </div>
                    )}
                    {feeling.feeling_text && (
                      <div className="text-slate-400">{feeling.feeling_text}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

        {/* PnL History */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <div className="p-3 border-b border-slate-700 text-slate-300 font-semibold">
          PnL History
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700">
              <tr>
                <th className="text-left p-3 text-slate-300">Time</th>
                <th className="text-right p-3 text-slate-300">Mark Price</th>
                <th className="text-right p-3 text-slate-300">PnL USD</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-t border-slate-700 hover:bg-slate-800">
                  <td className="p-3 text-slate-300">
                    {new Date(h.ts).toLocaleString()}
                  </td>
                  <td className="p-3 text-right text-slate-300 font-mono text-sm">
                    {formatPrice(h.mark_price)}
                  </td>
                  <td
                    className={`p-3 text-right font-semibold ${
                      h.pnl_usd >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {formatCurrency(h.pnl_usd)}
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-4 text-center text-slate-400">
                    No snapshots recorded
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
      </div>
    </div>
  )
}
