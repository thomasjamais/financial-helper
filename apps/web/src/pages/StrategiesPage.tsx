import { useState } from 'react'
import { StrategyList } from '../components/StrategyList'
import { StrategyEditor } from '../components/StrategyEditor'
import { BacktestRunner } from '../components/BacktestRunner'
import { BacktestResults } from '../components/BacktestResults'
import {
  useCreateStrategy,
  useUpdateStrategy,
  useStrategy,
  type Strategy,
  type CreateStrategyInput,
  type UpdateStrategyInput,
} from '../hooks/useStrategies'

type View = 'list' | 'editor' | 'backtest' | 'results'

export default function StrategiesPage() {
  const [view, setView] = useState<View>('list')
  const [selectedStrategyId, setSelectedStrategyId] = useState<number | null>(null)
  const [backtestResult, setBacktestResult] = useState<unknown | null>(null)

  const { data: strategy } = useStrategy(selectedStrategyId || 0)
  const createStrategy = useCreateStrategy()
  const updateStrategy = useUpdateStrategy()

  function handleSelectStrategy(strategy: Strategy) {
    setSelectedStrategyId(strategy.id)
    setView('editor')
  }

  function handleNewStrategy() {
    setSelectedStrategyId(null)
    setView('editor')
  }

  function handleBackToList() {
    setView('list')
    setSelectedStrategyId(null)
    setBacktestResult(null)
  }

  function handleBacktest(strategy: Strategy) {
    setSelectedStrategyId(strategy.id)
    setView('backtest')
  }

  async function handleSave(input: CreateStrategyInput | UpdateStrategyInput) {
    if (selectedStrategyId) {
      await updateStrategy.mutateAsync({ id: selectedStrategyId, input: input as UpdateStrategyInput })
    } else {
      if (!input.name || !input.code) {
        alert('Name and code are required')
        return
      }
      await createStrategy.mutateAsync(input as CreateStrategyInput)
    }
    handleBackToList()
  }

  function handleBacktestComplete(result: unknown) {
    setBacktestResult(result)
    setView('results')
  }

  if (view === 'list') {
    return (
      <div>
        <StrategyList onSelectStrategy={handleSelectStrategy} onNewStrategy={handleNewStrategy} />
      </div>
    )
  }

  if (view === 'editor') {
    return (
      <div>
        <div className="mb-4">
          <button
            onClick={handleBackToList}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
          >
            ← Back to List
          </button>
        </div>
        <StrategyEditor
          strategy={strategy || undefined}
          onSave={handleSave}
          onCancel={handleBackToList}
        />
        {strategy && (
          <div className="mt-6">
            <button
              onClick={() => handleBacktest(strategy)}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              Run Backtest
            </button>
          </div>
        )}
      </div>
    )
  }

  if (view === 'backtest' && strategy) {
    return (
      <div>
        <div className="mb-4">
          <button
            onClick={() => setView('editor')}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
          >
            ← Back to Editor
          </button>
        </div>
        <BacktestRunner strategy={strategy} onBacktestComplete={handleBacktestComplete} />
      </div>
    )
  }

  if (view === 'results' && backtestResult) {
    return (
      <div>
        <div className="mb-4">
          <button
            onClick={() => setView('backtest')}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
          >
            ← Back to Backtest
          </button>
        </div>
        <BacktestResults result={backtestResult as any} />
      </div>
    )
  }

  return null
}

