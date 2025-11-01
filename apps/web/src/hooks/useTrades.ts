import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useAuth } from '../components/AuthContext'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

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
    queryFn: async () =>
      (
        await axios.get<Trade[]>(`${API_BASE}/v1/trades/with-pnl`, {
          headers: accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : undefined,
        })
      ).data,
    enabled: !!accessToken,
    refetchInterval: 30000,
  })
}

