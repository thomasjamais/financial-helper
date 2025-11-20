import { useState } from 'react'
import { formatNumber } from '../lib/format'
import {
  useScalpingStrategies,
  useCreateScalpingStrategy,
  useUpdateScalpingStrategy,
  useDeleteScalpingStrategy,
  useToggleScalpingStrategy,
  type ScalpingStrategy,
  type ScalpingStrategyFormData,
} from '../hooks/scalping/useScalpingStrategies'

const DEFAULT_FORM_DATA: ScalpingStrategyFormData = {
  exchange: 'bitget',
  symbol: '',
  maxCapital: 500,
  leverage: 10,
  riskPerTrade: 0.02,
  minConfidence: 0.6,
  maxOpenPositions: 3,
  feeRate: 0.001,
  slippageBps: 5,
}

export function ScalpingStrategies() {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ScalpingStrategy | null>(null)
  const [formData, setFormData] =
    useState<ScalpingStrategyFormData>(DEFAULT_FORM_DATA)

  const { data: strategies, isLoading } = useScalpingStrategies()
  const createMutation = useCreateScalpingStrategy()
  const updateMutation = useUpdateScalpingStrategy()
  const deleteMutation = useDeleteScalpingStrategy()
  const toggleActiveMutation = useToggleScalpingStrategy()

  const resetForm = () => {
    setFormData(DEFAULT_FORM_DATA)
    setEditing(null)
    setShowForm(false)
  }

  const handleEdit = (strategy: ScalpingStrategy) => {
    setEditing(strategy)
    setFormData({
      exchange: strategy.exchange,
      symbol: strategy.symbol,
      maxCapital: strategy.maxCapital,
      leverage: strategy.leverage,
      riskPerTrade: strategy.riskPerTrade,
      minConfidence: strategy.minConfidence,
      maxOpenPositions: strategy.maxOpenPositions,
      feeRate: strategy.feeRate,
      slippageBps: strategy.slippageBps,
    })
    setShowForm(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, data: formData },
        {
          onSuccess: () => resetForm(),
        },
      )
    } else {
      createMutation.mutate(formData, {
        onSuccess: () => resetForm(),
      })
    }
  }

  return (
    <div className="bg-slate-900 rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">
          Automated Scalping Strategies
        </h2>
        <button
          onClick={() => {
            resetForm()
            setShowForm(true)
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
        >
          + New Strategy
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 p-4 bg-slate-800 rounded-lg space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Exchange
              </label>
              <select
                value={formData.exchange}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    exchange: e.target.value as 'bitget' | 'binance',
                  })
                }
                className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
                required
              >
                <option value="bitget">Bitget</option>
                <option value="binance">Binance</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Symbol
              </label>
              <input
                type="text"
                value={formData.symbol}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    symbol: e.target.value.toUpperCase(),
                  })
                }
                className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
                placeholder="BTCUSDT"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Max Capital (USDT)
              </label>
              <input
                type="number"
                value={formData.maxCapital}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    maxCapital: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
                min="1"
                step="100"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Leverage
              </label>
              <input
                type="number"
                value={formData.leverage}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    leverage: parseInt(e.target.value) || 1,
                  })
                }
                className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
                min="1"
                max="125"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Risk Per Trade (%)
              </label>
              <input
                type="number"
                value={formData.riskPerTrade * 100}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    riskPerTrade: (parseFloat(e.target.value) || 0) / 100,
                  })
                }
                className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
                min="0"
                max="100"
                step="0.1"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Min Confidence (%)
              </label>
              <input
                type="number"
                value={formData.minConfidence * 100}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    minConfidence: (parseFloat(e.target.value) || 0) / 100,
                  })
                }
                className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
                min="0"
                max="100"
                step="1"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Max Open Positions
              </label>
              <input
                type="number"
                value={formData.maxOpenPositions}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    maxOpenPositions: parseInt(e.target.value) || 1,
                  })
                }
                className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
                min="1"
                max="10"
                required
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition"
            >
              {editing ? 'Update' : 'Create'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="text-slate-400">Loading strategies...</div>
      ) : !strategies || strategies.length === 0 ? (
        <div className="text-slate-400 text-center py-8">
          No automated strategies yet. Create your first one!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {strategies.map((strategy) => (
            <div
              key={strategy.id}
              className={`p-4 rounded-lg border-2 ${
                strategy.isActive
                  ? 'border-green-500 bg-slate-800'
                  : 'border-slate-700 bg-slate-800'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-white">
                    {strategy.symbol}
                  </h3>
                  <p className="text-sm text-slate-400 capitalize">
                    {strategy.exchange} •{' '}
                    {strategy.isActive ? 'Active' : 'Inactive'}
                  </p>
                </div>
                {strategy.isActive && (
                  <span className="px-2 py-1 bg-green-600 text-white text-xs rounded">
                    Active
                  </span>
                )}
              </div>

              <div className="space-y-1 text-sm text-slate-300 mt-3">
                <div>
                  Max Capital:{' '}
                  {formatNumber(strategy.maxCapital, {
                    maximumFractionDigits: 0,
                  })}{' '}
                  USDT
                </div>
                <div>Leverage: {strategy.leverage}x</div>
                <div>
                  Risk/Trade: {(strategy.riskPerTrade * 100).toFixed(1)}%
                </div>
                <div>
                  Min Confidence: {(strategy.minConfidence * 100).toFixed(0)}%
                </div>
                <div>Max Positions: {strategy.maxOpenPositions}</div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() =>
                    toggleActiveMutation.mutate({
                      id: strategy.id,
                      isActive: !strategy.isActive,
                    })
                  }
                  disabled={toggleActiveMutation.isPending}
                  className={`flex-1 px-3 py-1.5 text-white text-sm rounded transition ${
                    strategy.isActive
                      ? 'bg-orange-600 hover:bg-orange-700'
                      : 'bg-green-600 hover:bg-green-700'
                  } disabled:opacity-50`}
                >
                  {strategy.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => handleEdit(strategy)}
                  className="px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded transition"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    if (confirm('Delete this strategy?')) {
                      deleteMutation.mutate(strategy.id)
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm rounded transition"
                >
                  Del
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
