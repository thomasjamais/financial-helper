import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

type Opportunity = {
  id: string
  asset: string
  name: string
  type?: 'flexible' | 'locked' | 'staking' | 'launchpool'
  apr: number
  durationDays?: number
  redeemable: boolean
  score: number
}

export function EarnOpportunities() {
  const [minScore, setMinScore] = useState<string>('0.7')
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['binance', 'earn', 'opportunities', minScore],
    queryFn: async () =>
      (
        await axios.get<Opportunity[]>(
          '/v1/binance/earn/opportunities',
          {
            baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8080',
            params: { minScore },
          },
        )
      ).data,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const list = data || []

  return (
    <div className="space-y-4 bg-slate-900 rounded-lg p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Opportunities</h2>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-400" title="Filter products by overall score (0-1). Higher means more attractive considering APR, duration and liquidity.">Min score</label>
          <input
            type="number"
            step="0.05"
            min="0"
            max="1"
            value={minScore}
            onChange={(e) => setMinScore(e.target.value)}
            placeholder="0.70"
            className="w-28 border border-slate-600 bg-slate-800 text-white p-2 rounded"
          />
          <button
            onClick={() => refetch()
            }
            disabled={isFetching}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
          >
            {isFetching ? 'Refreshing...' : 'Apply'}
          </button>
        </div>
      </div>

      {isLoading && <p className="text-slate-400">Loading...</p>}
      {error && <p className="text-red-400">Failed to load</p>}

      <div className="border rounded-lg overflow-hidden border-slate-700 bg-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700">
              <tr>
                <th className="text-left p-3 text-slate-300">Name</th>
                <th className="text-left p-3 text-slate-300">Asset</th>
                <th className="text-right p-3 text-slate-300">APR</th>
                <th className="text-right p-3 text-slate-300">Duration</th>
                <th className="text-center p-3 text-slate-300">Redeemable</th>
                <th className="text-right p-3 text-slate-300">Score</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="border-t border-slate-700 hover:bg-slate-800">
                  <td className="p-3 text-white">{p.name}</td>
                  <td className="p-3 text-slate-300">{p.asset}</td>
                  <td className="p-3 text-right text-slate-300">{(p.apr * 100).toFixed(2)}%</td>
                  <td className="p-3 text-right text-slate-300">{p.durationDays ?? '-'}</td>
                  <td className="p-3 text-center text-slate-300">{p.redeemable ? 'Yes' : 'No'}</td>
                  <td className="p-3 text-right text-slate-300">{p.score.toFixed(2)}</td>
                </tr>
              ))}
              {list.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-slate-400">No opportunities</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AutoPlanPanel />
    </div>
  )
}

function AutoPlanPanel() {
  const [minApr, setMinApr] = useState(0.03)
  const [totalPct, setTotalPct] = useState(0.5)
  const [maxPerProductPct, setMaxPerProductPct] = useState(0.2)
  const [minAmount, setMinAmount] = useState(5)
  const [roundTo, setRoundTo] = useState(0.01)
  const [result, setResult] = useState<any | null>(null)
  const [executed, setExecuted] = useState<any | null>(null)
  const [unsubMinApr, setUnsubMinApr] = useState(0.02)
  const [targetFree, setTargetFree] = useState(0)

  return (
    <div className="p-4 bg-slate-800 rounded border border-slate-700">
      <div className="font-semibold text-white mb-2">Auto-Subscribe Plan (simulation)</div>
      <div className="mb-3 text-xs text-slate-400">Build a suggested allocation; this does not move funds.</div>
      <div className="grid grid-cols-3 gap-3 mb-3 text-slate-200">
        <label className="text-sm">Min APR
          <div className="text-xs text-slate-400">Only include products with APR ≥ this value.</div>
          <input className="w-full mt-1 p-2 rounded bg-slate-700" type="number" step="0.001" placeholder="0.03 = 3%" value={minApr} onChange={(e) => setMinApr(parseFloat(e.target.value))} />
        </label>
        <label className="text-sm">Total % to allocate
          <div className="text-xs text-slate-400">Fraction of your free USDT/USDC to deploy.</div>
          <input className="w-full mt-1 p-2 rounded bg-slate-700" type="number" step="0.01" placeholder="0.5 = 50%" value={totalPct} onChange={(e) => setTotalPct(parseFloat(e.target.value))} />
        </label>
        <label className="text-sm">Max per product %
          <div className="text-xs text-slate-400">Cap per product to avoid concentration.</div>
          <input className="w-full mt-1 p-2 rounded bg-slate-700" type="number" step="0.01" placeholder="0.2 = 20%" value={maxPerProductPct} onChange={(e) => setMaxPerProductPct(parseFloat(e.target.value))} />
        </label>
        <label className="text-sm">Min amount
          <div className="text-xs text-slate-400">Drop plan lines smaller than this amount.</div>
          <input className="w-full mt-1 p-2 rounded bg-slate-700" type="number" step="0.01" placeholder="e.g., 5" value={minAmount} onChange={(e) => setMinAmount(parseFloat(e.target.value))} />
        </label>
        <label className="text-sm">Round to
          <div className="text-xs text-slate-400">Round down amounts to this step size.</div>
          <input className="w-full mt-1 p-2 rounded bg-slate-700" type="number" step="0.01" placeholder="0.01" value={roundTo} onChange={(e) => setRoundTo(parseFloat(e.target.value))} />
        </label>
      </div>
      <button className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded" title="Build a suggested allocation; no funds are moved." onClick={async () => {
        const res = await axios.post((import.meta as any).env.VITE_API_URL + '/v1/binance/earn/auto/plan', { minApr, totalPct, maxPerProductPct, minAmount, roundTo })
        setResult(res.data)
      }}>Build plan</button>
      {result && (
        <button className="ml-2 px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded" title="Simulate the subscribe steps; no funds are moved." onClick={async () => {
          const res = await axios.post((import.meta as any).env.VITE_API_URL + '/v1/binance/earn/auto/execute', { dryRun: true, plan: result.plan })
          setExecuted(res.data)
        }}>Execute (dry run)</button>
      )}
      {result && (
        <div className="mt-3 text-slate-300 text-sm">
          <div>Spot Stable: {JSON.stringify(result.spotStable)}</div>
          {result.stats && (
            <div className="mt-1 space-y-1">
              <div>Total planned: {result.stats.totalPlanned}</div>
              <div>Unused budget: {result.stats.unusedBudgetTotal}</div>
              <div>Capped lines: {result.stats.cappedCount}</div>
            </div>
          )}
          <div className="mt-2">Plan:</div>
          <ul className="list-disc ml-6">
            {result.plan.map((p: any) => (
              <li key={p.productId}>{p.asset} → {p.amount} (APR {(p.apr*100).toFixed(2)}%)</li>
            ))}
          </ul>
        </div>
      )}
      {executed && (
        <div className="mt-3 text-slate-300 text-sm">Executed (dry run): {executed.steps?.length} steps</div>
      )}

      <div className="mt-6">
        <div className="font-semibold text-white mb-2">Unsubscribe Plan (simulation)</div>
        <div className="mb-3 text-xs text-slate-400">Propose redeems to free liquidity or exit low-APR positions; no funds are moved.</div>
        <div className="grid grid-cols-3 gap-3 mb-3 text-slate-200">
          <label className="text-sm">Min APR
            <div className="text-xs text-slate-400">Redeem positions with APR below this value.</div>
            <input className="w-full mt-1 p-2 rounded bg-slate-700" type="number" step="0.001" placeholder="0.02 = 2%" value={unsubMinApr} onChange={(e) => setUnsubMinApr(parseFloat(e.target.value))} />
          </label>
          <label className="text-sm">Target free amount
            <div className="text-xs text-slate-400">Additional stablecoins to free in Spot (e.g., for trades).</div>
            <input className="w-full mt-1 p-2 rounded bg-slate-700" type="number" step="0.01" placeholder="e.g., 500" value={targetFree} onChange={(e) => setTargetFree(parseFloat(e.target.value))} />
          </label>
        </div>
        <button className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded" title="Build a suggested redeem plan; no funds are moved." onClick={async () => {
          const res = await axios.post((import.meta as any).env.VITE_API_URL + '/v1/binance/earn/auto/unsubscribe/plan', { minApr: unsubMinApr, targetFreeAmount: targetFree })
          setResult(res.data)
        }}>Build unsubscribe plan</button>
      </div>
    </div>
  )
}


