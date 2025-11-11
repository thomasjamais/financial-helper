import { useState } from 'react'
import { useStrategies, useDeleteStrategy, useUpdateAllocation, useDuplicateStrategy, useExampleStrategies, type Strategy } from '../hooks/useStrategies'
import { formatNumber } from '../lib/format'

type StrategyListProps = {
  onSelectStrategy: (strategy: Strategy) => void
  onNewStrategy: () => void
}

export function StrategyList({ onSelectStrategy, onNewStrategy }: StrategyListProps) {
  const { data: strategies, isLoading, error } = useStrategies()
  const { data: exampleStrategies, isLoading: examplesLoading } = useExampleStrategies()
  const deleteStrategy = useDeleteStrategy()
  const updateAllocation = useUpdateAllocation()
  const duplicateStrategy = useDuplicateStrategy()
  const [editingAllocation, setEditingAllocation] = useState<number | null>(null)
  const [allocationValue, setAllocationValue] = useState('')
  const [showExamples, setShowExamples] = useState(false)
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null)

  function handleDelete(id: number, name: string) {
    if (confirm(`Are you sure you want to delete strategy "${name}"?`)) {
      deleteStrategy.mutate(id)
    }
  }

  function handleEditAllocation(strategy: Strategy) {
    setEditingAllocation(strategy.id)
    setAllocationValue(strategy.allocated_amount_usd.toString())
  }

  function handleSaveAllocation(id: number) {
    const value = Number.parseFloat(allocationValue)
    if (isNaN(value) || value < 0) {
      alert('Invalid allocation amount')
      return
    }

    updateAllocation.mutate({ id, allocated_amount_usd: value })
    setEditingAllocation(null)
  }

  function handleCancelAllocation() {
    setEditingAllocation(null)
    setAllocationValue('')
  }

  async function handleDuplicate(strategy: Strategy) {
    const newName = prompt(`Enter a name for the duplicated strategy:`, `${strategy.name} (Copy)`)
    if (!newName || newName.trim().length === 0) {
      return
    }

    setDuplicatingId(strategy.id)
    try {
      await duplicateStrategy.mutateAsync({ id: strategy.id, name: newName.trim() })
      alert('Strategy duplicated successfully!')
    } catch (error) {
      alert(`Failed to duplicate strategy: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setDuplicatingId(null)
    }
  }

  if (isLoading) {
    return <div className="text-center py-8 text-slate-300">Loading strategies...</div>
  }

  if (error) {
    return <div className="text-center py-8 text-red-400">Failed to load strategies</div>
  }

  if (!strategies || strategies.length === 0) {
    return (
      <div className="text-center py-8 bg-slate-900 rounded-lg p-6">
        <p className="text-slate-300 mb-4">No strategies yet</p>
        <button
          onClick={onNewStrategy}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Create Strategy
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 bg-slate-900 rounded-lg p-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Strategies</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setShowExamples(!showExamples)}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
          >
            {showExamples ? 'Hide Examples' : 'Browse Examples'}
          </button>
          <button
            onClick={onNewStrategy}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Create Strategy
          </button>
        </div>
      </div>

      {showExamples && (
        <div className="border border-slate-700 rounded-lg p-6 bg-slate-800">
          <h3 className="text-lg font-semibold mb-4 text-white">Example Strategies</h3>
          {examplesLoading ? (
            <div className="text-center py-4 text-slate-300">Loading examples...</div>
          ) : exampleStrategies && exampleStrategies.length > 0 ? (
            <div className="space-y-3">
              {exampleStrategies.map((example) => (
                <div
                  key={example.id}
                  className="flex justify-between items-center p-4 bg-slate-700 rounded-lg border border-slate-600 hover:bg-slate-600 transition-colors"
                >
                  <div>
                    <span className="font-medium text-white">{example.name}</span>
                    <span className="text-xs text-slate-400 ml-2">(Example)</span>
                  </div>
                  <button
                    onClick={() => handleDuplicate(example)}
                    disabled={duplicatingId === example.id}
                    className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {duplicatingId === example.id ? 'Duplicating...' : 'Duplicate'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-slate-400">No example strategies available</div>
          )}
        </div>
      )}

      <div className="grid gap-4">
        {strategies.map((strategy) => (
          <div
            key={strategy.id}
            className="border border-slate-700 rounded-lg p-6 bg-slate-800 hover:bg-slate-700/50 transition-colors"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">{strategy.name}</h3>
                <p className="text-sm">
                  {strategy.is_active ? (
                    <span className="text-green-400">● Active</span>
                  ) : (
                    <span className="text-slate-400">● Inactive</span>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onSelectStrategy(strategy)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDuplicate(strategy)}
                  disabled={duplicatingId === strategy.id}
                  className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {duplicatingId === strategy.id ? 'Duplicating...' : 'Duplicate'}
                </button>
                <button
                  onClick={() => handleDelete(strategy.id, strategy.name)}
                  className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="mt-4">
              {editingAllocation === strategy.id ? (
                <div className="flex gap-3 items-center">
                  <label className="text-sm font-medium text-slate-300">Allocation (USD):</label>
                  <input
                    type="number"
                    value={allocationValue}
                    onChange={(e) => setAllocationValue(e.target.value)}
                    min="0"
                    step="0.01"
                    className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm w-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => handleSaveAllocation(strategy.id)}
                    className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleCancelAllocation}
                    className="px-4 py-2 bg-slate-600 text-white text-sm rounded-lg hover:bg-slate-500 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-sm font-medium text-slate-300">Allocation: </span>
                    <span className="text-sm text-white font-mono">${formatNumber(strategy.allocated_amount_usd)}</span>
                  </div>
                  <button
                    onClick={() => handleEditAllocation(strategy)}
                    className="px-4 py-2 bg-slate-700 text-white text-sm rounded-lg hover:bg-slate-600 transition-colors"
                  >
                    Edit Allocation
                  </button>
                </div>
              )}
            </div>

            <div className="mt-3 text-xs text-slate-400">
              Created: {new Date(strategy.created_at).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

