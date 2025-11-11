import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useAuth } from '../components/AuthContext'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

export type TradeFeeling = {
  id: number
  feeling_text: string | null
  sentiment_score: number | null
  timeframe: string
  created_at: string
}

export type TradeDetail = {
  trade: {
    id: number
    idea_id: number | null
    exchange: string
    symbol: string
    side: 'BUY' | 'SELL'
    budget_usd: number
    quantity: number
    entry_price: number
    tp_pct: number
    sl_pct: number
    status: string
    opened_at: string | null
    closed_at: string | null
    pnl_usd: number | null
    metadata: any
  }
  currentMarkPrice: number | null
  tpPrice: number | null
  slPrice: number | null
  expectedPnLAtTp: number | null
  expectedPnLAtSl: number | null
  currentUnrealizedPnL: number | null
  riskRewardRatio: number | null
  probabilityEstimate: number | null
  feelings: TradeFeeling[]
  history: Array<{
    id: number
    trade_id: number
    ts: string
    mark_price: number
    pnl_usd: number
  }>
}

export type CreateTradeFeelingInput = {
  feeling_text?: string | null
  sentiment_score?: number | null
  timeframe: '1min' | '5min' | '30min' | '1h' | '4h' | '1d' | '1w' | '1m' | '1y'
}

export type UpdateTradeFeelingInput = {
  feeling_text?: string | null
  sentiment_score?: number | null
}

export function useTradeDetail(tradeId: number | null) {
  const { accessToken } = useAuth()

  return useQuery({
    queryKey: ['trade-detail', tradeId],
    queryFn: async () => {
      if (!tradeId) return null
      const response = await axios.get<TradeDetail>(
        `${API_BASE}/v1/trades/${tradeId}`,
        {
          headers: accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : undefined,
        },
      )
      return response.data
    },
    enabled: !!tradeId && !!accessToken,
  })
}

export function useCreateTradeFeeling() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      tradeId,
      input,
    }: {
      tradeId: number
      input: CreateTradeFeelingInput
    }) => {
      const response = await axios.post(
        `${API_BASE}/v1/trades/${tradeId}/feelings`,
        input,
        {
          headers: accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : undefined,
        },
      )
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['trade-detail', variables.tradeId] })
    },
  })
}

export function useUpdateTradeFeeling() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      tradeId,
      feelingId,
      input,
    }: {
      tradeId: number
      feelingId: number
      input: UpdateTradeFeelingInput
    }) => {
      const response = await axios.put(
        `${API_BASE}/v1/trades/${tradeId}/feelings/${feelingId}`,
        input,
        {
          headers: accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : undefined,
        },
      )
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['trade-detail', variables.tradeId] })
    },
  })
}

