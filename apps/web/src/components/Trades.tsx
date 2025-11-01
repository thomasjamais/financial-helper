import { useState } from 'react'
import {
  formatPrice,
  formatQuantity,
  formatCurrency,
} from '../lib/numberFormat'
import { useTrades } from '../hooks/useTrades'

export default function Trades() {
  const { data, isLoading, error, refetch, isFetching } = useTrades()
  const [pnlDisplayMode, setPnlDisplayMode] = useState<'amount' | 'percentage'>(
    'amount',
  )

  return (
    <div className="space-y-4 bg-slate-900 rounded-lg p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Trades</h2>
        <div className="flex items-center gap-4">
          {/* PnL Display Mode Toggle */}
          <div className="flex items-center gap-2 bg-slate-800 rounded-lg p-1 border border-slate-700">
            <button
              onClick={() => setPnlDisplayMode('amount')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                pnlDisplayMode === 'amount'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Amount
            </button>
            <button
              onClick={() => setPnlDisplayMode('percentage')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                pnlDisplayMode === 'percentage'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              %
            </button>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
          >
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>
      {isLoading && <div className="text-slate-300">Loading…</div>}
      {error && <div className="text-red-400">Failed to load</div>}
      <div className="border rounded-lg overflow-hidden border-slate-700 bg-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700">
              <tr>
                <th className="text-left p-3 text-slate-300">Time</th>
                <th className="text-left p-3 text-slate-300">Symbol</th>
                <th className="text-left p-3 text-slate-300">Side</th>
                <th className="text-right p-3 text-slate-300">Entry</th>
                <th className="text-right p-3 text-slate-300">Mark</th>
                <th className="text-right p-3 text-slate-300">Qty</th>
                <th className="text-right p-3 text-slate-300">Budget USD</th>
                <th className="text-right p-3 text-slate-300">TP/SL</th>
                <th className="text-right p-3 text-slate-300">
                  {pnlDisplayMode === 'amount' ? 'PnL' : 'PnL %'}
                </th>
                <th className="text-left p-3 text-slate-300">Status</th>
                <th className="text-right p-3 text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(data || []).map((t) => (
                <tr
                  key={t.id}
                  className="border-t border-slate-700 hover:bg-slate-800"
                >
                  <td className="p-3 text-slate-300">
                    {new Date(t.opened_at).toLocaleString()}
                  </td>
                  <td className="p-3 text-white">{t.symbol}</td>
                  <td className="p-3 text-slate-300">{t.side}</td>
                  <td className="p-3 text-right text-slate-300 font-mono text-sm">
                    {formatPrice(t.entry_price)}
                  </td>
                  <td className="p-3 text-right text-slate-300 font-mono text-sm">
                    {formatPrice(t.markPrice)}
                  </td>
                  <td className="p-3 text-right text-slate-300 font-mono text-sm">
                    {formatQuantity(t.quantity)}
                  </td>
                  <td className="p-3 text-right text-slate-300">
                    {formatCurrency(t.budget_usd)}
                  </td>
                  <td className="p-3 text-right text-slate-300">
                    {t.tpPrice ? (
                      <span className="text-green-400 font-mono text-sm">
                        {formatPrice(t.tpPrice)}
                      </span>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}{' '}
                    /{' '}
                    {t.slPrice ? (
                      <span className="text-red-400 font-mono text-sm">
                        {formatPrice(t.slPrice)}
                      </span>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                  <td
                    className={`p-3 text-right font-semibold ${
                      (t.pnl_usd ?? t.pnl_unrealized ?? 0) >= 0
                        ? 'text-green-400'
                        : 'text-red-400'
                    }`}
                  >
                    {(() => {
                      const pnl = t.pnl_usd ?? t.pnl_unrealized ?? 0
                      if (pnlDisplayMode === 'percentage') {
                        const percentage =
                          t.budget_usd > 0 ? (pnl / t.budget_usd) * 100 : 0
                        return `${percentage >= 0 ? '+' : ''}${percentage.toFixed(2)}%`
                      }
                      return formatCurrency(pnl)
                    })()}
                  </td>
                  <td className="p-3 text-slate-300">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
                        t.status === 'closed'
                          ? 'bg-purple-600 text-white'
                          : t.status === 'simulated'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-600 text-slate-300'
                      }`}
                    >
                      {t.status}
                    </span>
                    {t.pnl_usd !== null && t.pnl_usd !== undefined && (
                      <div
                        className={`text-xs mt-1 font-semibold ${
                          t.pnl_usd >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        Realized:{' '}
                        {pnlDisplayMode === 'percentage'
                          ? `${((t.pnl_usd / t.budget_usd) * 100).toFixed(2)}%`
                          : formatCurrency(t.pnl_usd)}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <a
                      href={`#/trade/${t.id}`}
                      className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded text-sm"
                    >
                      Detail
                    </a>
                  </td>
                </tr>
              ))}
              {(!data || data.length === 0) && !isLoading && (
                <tr>
                  <td colSpan={11} className="p-4 text-center text-slate-400">
                    No trades
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}