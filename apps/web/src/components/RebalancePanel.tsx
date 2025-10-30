import axios from 'axios'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import RebalanceSummary from './RebalanceSummary'
import RebalanceSuggestions from './RebalanceSuggestions'

type RebalancingSuggestion = {
  asset: string
  currentAllocation: number
  recommendedAllocation: number
  action: 'BUY' | 'SELL' | 'HOLD'
  reason: string
}

type RebalanceAdvice = {
  suggestions: RebalancingSuggestion[]
  summary: string
  confidence: number
}

export default function RebalancePanel() {
  const [rebalanceMode, setRebalanceMode] = useState<'spot' | 'earn' | 'overview'>('overview')
  const rebalance = useMutation({
    mutationFn: async (params: { mode: 'spot' | 'earn' | 'overview' }) => {
      const res = await axios.post<RebalanceAdvice>(
        '/v1/binance/rebalance',
        params,
        { baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8080' },
      )
      return res.data
    },
  })

  return (
    <div className="border rounded-lg p-4 bg-slate-800 border-slate-700">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-white">AI Portfolio Rebalancing</h3>
      </div>
      <div className="space-y-3">
        <div>
          <p className="text-sm text-slate-400 mb-3">Uses OpenAI API key from server environment variables.</p>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-slate-300">Mode:</span>
            <select
              className="border border-slate-600 bg-slate-700 text-white p-1 rounded"
              value={rebalanceMode}
              onChange={(e) => setRebalanceMode(e.target.value as any)}
            >
              <option value="overview">Overview</option>
              <option value="spot">Spot only</option>
              <option value="earn">Earn only</option>
            </select>
          </div>
          <button
            onClick={() => rebalance.mutate({ mode: rebalanceMode })}
            disabled={rebalance.isPending}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded disabled:opacity-50 transition"
          >
            {rebalance.isPending ? 'Generating advice...' : 'Get Rebalancing Advice'}
          </button>
        </div>
        {rebalance.data && (
          <div className="mt-4 space-y-2">
            <RebalanceSummary summary={rebalance.data.summary} confidence={rebalance.data.confidence} />
            <RebalanceSuggestions suggestions={rebalance.data.suggestions} />
            <button
              onClick={() => {
                const lines = [
                  `AI Rebalancing Report`,
                  `Mode: ${rebalanceMode}`,
                  '',
                  `Summary: ${rebalance.data?.summary}`,
                  `Confidence: ${(rebalance.data?.confidence * 100).toFixed(0)}%`,
                  '',
                  'Suggestions:',
                  ...rebalance.data!.suggestions.map((s) => `- ${s.asset}: ${s.action} (from ${s.currentAllocation.toFixed(2)}% to ${s.recommendedAllocation.toFixed(2)}%) – ${s.reason}`),
                ]
                const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `ai-rebalancing-${rebalanceMode}-${Date.now()}.md`
                a.click()
                URL.revokeObjectURL(url)
              }}
              className="mt-2 px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded"
            >
              Download Report
            </button>
          </div>
        )}
      </div>
    </div>
  )
}


