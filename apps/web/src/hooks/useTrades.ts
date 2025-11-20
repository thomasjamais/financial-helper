import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../components/AuthContext'
import { apiClient } from '../lib/api'

export type Trade = {
  id: number
  symbol: string
  side: 'BUY' | 'SELL'
  budget_usd: number
  quantity: number
  entry_price: number
  tp_pct: number
  sl_pct: number
  status: string
  opened_at: string
  closed_at?: string | null
  pnl_unrealized?: number | null
  pnl_usd?: number | null
  markPrice?: number | null
  tpPrice?: number | null
  slPrice?: number | null
}

export function useTrades() {
  const { accessToken } = useAuth()
  
  return useQuery({
    queryKey: ['trades-with-pnl'],
    queryFn: async () => {
      const response = await apiClient.get<Trade[]>('/v1/trades/with-pnl')
      return response.data
    },
    enabled: !!accessToken,
    refetchInterval: 30000,
  })
}

