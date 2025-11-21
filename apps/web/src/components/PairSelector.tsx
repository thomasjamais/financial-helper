import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { apiClient } from '../lib/api'
import { useAuth } from './AuthContext'

interface FuturesSymbol {
  symbol: string
  baseAsset: string
  quoteAsset: string
  volume24h: number
}

export function PairSelector({
  onSelectPair,
  selectedPair,
}: {
  onSelectPair: (symbol: string) => void
  selectedPair: string | null
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const { accessToken } = useAuth()

  // Check both context and localStorage to ensure token is available
  const hasToken = !!accessToken || !!localStorage.getItem('accessToken')

  const { data, isLoading, error } = useQuery({
    queryKey: ['bitget-futures-symbols'],
    queryFn: async () => {
      const response = await apiClient.get<{ symbols: FuturesSymbol[] }>(
        '/v1/bitget/futures-symbols',
      )
      return response.data
    },
    enabled: hasToken,
    refetchInterval: 300000,
  })

  const symbols = data?.symbols || []

  const filteredSymbols = symbols.filter((s) =>
    s.symbol.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  if (isLoading) {
    return (
      <div className="bg-slate-900 rounded-lg p-6">
        <div className="text-slate-400">Loading pairs...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-slate-900 rounded-lg p-6">
        <div className="text-red-400">
          Failed to load pairs. Please check your Bitget configuration.
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-900 rounded-lg p-6">
      <div className="mb-4">
        <h3 className="text-xl font-bold text-white mb-2">
          Bitget Futures USDT Pairs (Top 50)
        </h3>
        <input
          type="text"
          placeholder="Search pairs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 bg-slate-800 text-white rounded border border-slate-700 focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-96 overflow-y-auto">
        {filteredSymbols.map((symbol) => (
          <button
            key={symbol.symbol}
            onClick={() => onSelectPair(symbol.symbol)}
            className={`px-3 py-2 rounded text-sm transition ${
              selectedPair === symbol.symbol
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <div className="font-semibold">{symbol.symbol}</div>
            <div className="text-xs opacity-75">
              Vol: {formatVolume(symbol.volume24h)}
            </div>
          </button>
        ))}
      </div>

      {filteredSymbols.length === 0 && (
        <div className="text-slate-400 text-center py-4">
          No pairs found matching "{searchTerm}"
        </div>
      )}
    </div>
  )
}

function formatVolume(volume: number): string {
  if (volume >= 1e9) {
    return `${(volume / 1e9).toFixed(2)}B`
  }
  if (volume >= 1e6) {
    return `${(volume / 1e6).toFixed(2)}M`
  }
  if (volume >= 1e3) {
    return `${(volume / 1e3).toFixed(2)}K`
  }
  return volume.toFixed(2)
}
