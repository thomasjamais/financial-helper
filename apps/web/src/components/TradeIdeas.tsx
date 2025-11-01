import { useState } from 'react'
import {
  useTradeIdeas,
  useExecuteTradeIdea,
  validateBudget,
  type SortBy,
  type SortOrder,
} from '../hooks/useTradeIdeas'

export default function TradeIdeas() {
  const [sortBy, setSortBy] = useState<SortBy>('created_at')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const { data, isLoading, error, refetch, isFetching } = useTradeIdeas(
    sortBy,
    sortOrder,
  )
  const executeIdea = useExecuteTradeIdea()

  function handleSortClick(column: SortBy) {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }

  function handleExecuteClick(id: number) {
    const budgetStr = prompt('Budget in USD for this trade?', '50')
    const validation = validateBudget(budgetStr)

    if (!validation.valid) {
      alert(validation.error || 'Invalid budget')
      return
    }

    if (!confirm('Execute this idea with moderate risk TL/TP?')) {
      return
    }

    executeIdea.mutate(
      {
        id,
        budgetUSD: validation.budget!,
        risk: 'moderate',
      },
      {
        onSuccess: () => {
          alert('Trade idea executed successfully')
        },
        onError: (err: any) => {
          alert(err?.response?.data?.error || 'Failed to execute trade idea')
        },
      },
    )
  }

  return (
    <div className="space-y-4 bg-slate-900 rounded-lg p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Trade Ideas</h2>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
        >
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      {isLoading && <div className="text-slate-300">Loading…</div>}
      {error && <div className="text-red-400">Failed to load</div>}
      <div className="border rounded-lg overflow-hidden border-slate-700 bg-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700">
              <tr>
                <th
                  className="text-left p-3 text-slate-300 cursor-pointer hover:bg-slate-600 select-none"
                  onClick={() => handleSortClick('created_at')}
                >
                  Time{' '}
                  {sortBy === 'created_at' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="text-left p-3 text-slate-300">Exchange</th>
                <th className="text-left p-3 text-slate-300">Symbol</th>
                <th
                  className="text-left p-3 text-slate-300 cursor-pointer hover:bg-slate-600 select-none"
                  onClick={() => handleSortClick('side')}
                >
                  Side {sortBy === 'side' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="text-right p-3 text-slate-300 cursor-pointer hover:bg-slate-600 select-none"
                  onClick={() => handleSortClick('score')}
                >
                  Score{' '}
                  {sortBy === 'score' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="text-left p-3 text-slate-300">Reason</th>
                <th className="text-right p-3 text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(data || []).map((s) => (
                <tr
                  key={s.id}
                  className="border-t border-slate-700 hover:bg-slate-800"
                >
                  <td className="p-3 text-slate-300">
                    {new Date(s.created_at).toLocaleString()}
                  </td>
                  <td className="p-3 text-slate-300">{s.exchange}</td>
                  <td className="p-3 text-white">{s.symbol}</td>
                  <td className="p-3 text-slate-300">{s.side}</td>
                  <td className="p-3 text-right text-slate-300">
                    {(s.score * 100).toFixed(0)}%
                  </td>
                  <td className="p-3 text-slate-300">{s.reason || '-'}</td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => handleExecuteClick(s.id)}
                      disabled={executeIdea.isPending}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm disabled:opacity-50"
                    >
                      {executeIdea.isPending ? 'Executing...' : 'Execute'}
                    </button>
                  </td>
                </tr>
              ))}
              {(!data || data.length === 0) && !isLoading && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-slate-400">
                    No trade ideas
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
