import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

type ExchangeConfig = {
  id: number
  exchange: 'bitget' | 'binance'
  label: string
  env: 'paper' | 'live'
  baseUrl?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

function useExchangeConfigs() {
  return useQuery({
    queryKey: ['exchange-configs'],
    queryFn: async () =>
      (
        await axios.get<{ configs: ExchangeConfig[] }>(
          `${API_BASE}/v1/exchange-configs`,
        )
      ).data,
    refetchInterval: 5000,
  })
}

function useCreateConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: any) =>
      (await axios.post(`${API_BASE}/v1/exchange-configs`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exchange-configs'] }),
  })
}

function useUpdateConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) =>
      (await axios.put(`${API_BASE}/v1/exchange-configs/${id}`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exchange-configs'] }),
  })
}

function useDeleteConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) =>
      (await axios.delete(`${API_BASE}/v1/exchange-configs/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exchange-configs'] }),
  })
}

function useActivateConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) =>
      (await axios.post(`${API_BASE}/v1/exchange-configs/${id}/activate`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exchange-configs'] })
      qc.invalidateQueries({ queryKey: ['balances'] })
      qc.invalidateQueries({ queryKey: ['portfolio'] })
    },
  })
}

export function ExchangeConfigManager() {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ExchangeConfig | null>(null)
  const [formData, setFormData] = useState({
    exchange: 'binance' as 'bitget' | 'binance',
    label: '',
    key: '',
    secret: '',
    passphrase: '',
    env: 'paper' as 'paper' | 'live',
    baseUrl: '',
  })

  const { data, isLoading } = useExchangeConfigs()
  const create = useCreateConfig()
  const update = useUpdateConfig()
  const remove = useDeleteConfig()
  const activate = useActivateConfig()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      ...formData,
      passphrase: formData.passphrase || undefined,
      baseUrl: formData.baseUrl || undefined,
    }
    if (editing) {
      update.mutate({ id: editing.id, data: payload })
    } else {
      create.mutate(payload)
    }
    resetForm()
  }

  const resetForm = () => {
    setFormData({
      exchange: 'binance',
      label: '',
      key: '',
      secret: '',
      passphrase: '',
      env: 'paper',
      baseUrl: '',
    })
    setEditing(null)
    setShowForm(false)
  }

  const handleEdit = (config: ExchangeConfig) => {
    setEditing(config)
    setFormData({
      exchange: config.exchange,
      label: config.label,
      key: '***',
      secret: '***',
      passphrase: '***',
      env: config.env,
      baseUrl: config.baseUrl || '',
    })
    setShowForm(true)
  }

  const handleDelete = (id: number) => {
    if (confirm('Delete this config?')) {
      remove.mutate(id)
    }
  }

  const handleActivate = (id: number) => {
    activate.mutate(id)
  }

  const configs = data?.configs || []

  return (
    <div className="bg-slate-900 rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">
          Exchange Configurations
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
        >
          {showForm ? 'Cancel' : '+ New Config'}
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
                <option value="binance">Binance</option>
                <option value="bitget">Bitget</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Label
              </label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) =>
                  setFormData({ ...formData, label: e.target.value })
                }
                className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
                placeholder="My Binance Account"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                API Key
              </label>
              <input
                type="password"
                value={formData.key}
                onChange={(e) =>
                  setFormData({ ...formData, key: e.target.value })
                }
                className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
                required={!editing}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Secret
              </label>
              <input
                type="password"
                value={formData.secret}
                onChange={(e) =>
                  setFormData({ ...formData, secret: e.target.value })
                }
                className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
                required={!editing}
              />
            </div>
            {formData.exchange === 'bitget' && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Passphrase
                </label>
                <input
                  type="password"
                  value={formData.passphrase}
                  onChange={(e) =>
                    setFormData({ ...formData, passphrase: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Environment
              </label>
              <select
                value={formData.env}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    env: e.target.value as 'paper' | 'live',
                  })
                }
                className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
              >
                <option value="paper">Paper Trading</option>
                <option value="live">Live Trading</option>
              </select>
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
        <div className="text-slate-400">Loading...</div>
      ) : configs.length === 0 ? (
        <div className="text-slate-400 text-center py-8">
          No configurations yet. Create your first one!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {configs.map((config) => (
            <div
              key={config.id}
              className={`p-4 rounded-lg border-2 ${
                config.isActive
                  ? 'border-green-500 bg-slate-800'
                  : 'border-slate-700 bg-slate-800'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-white">{config.label}</h3>
                  <p className="text-sm text-slate-400 capitalize">
                    {config.exchange} • {config.env}
                  </p>
                </div>
                {config.isActive && (
                  <span className="px-2 py-1 bg-green-600 text-white text-xs rounded">
                    Active
                  </span>
                )}
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleActivate(config.id)}
                  disabled={activate.isPending || config.isActive}
                  className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded transition"
                >
                  {config.isActive ? 'Active' : 'Activate'}
                </button>
                <button
                  onClick={() => handleEdit(config)}
                  className="px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded transition"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(config.id)}
                  disabled={remove.isPending}
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
