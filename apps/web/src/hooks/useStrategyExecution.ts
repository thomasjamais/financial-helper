import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useAuth } from '../components/AuthContext'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

export type StrategyExecutionStatus = 'active' | 'paused' | 'stopped'

export type StrategyExecution = {
  id: number
  strategy_id: number
  user_id: string
  symbols: string[]
  interval: string
  status: StrategyExecutionStatus
  last_execution_at: string | null
  next_execution_at: string | null
  created_at: string
  updated_at: string
}

export type StrategyTrade = {
  id: number
  signal: 'buy' | 'sell'
  symbol: string
  created_at: string
  trade_id: number
  side: string
  quantity: number
  entry_price: number
  status: string
  pnl_usd: number | null
}

export function useStrategyExecution(strategyId: number) {
  const { accessToken } = useAuth()

  return useQuery({
    queryKey: ['strategy-execution', strategyId],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE}/v1/strategies/${strategyId}/execution`, {
        headers: accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : undefined,
      })
      return response.data.execution as StrategyExecution | null
    },
    enabled: !!accessToken && !!strategyId,
    refetchInterval: 10000,
  })
}

export function useStartExecution() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      strategyId,
      symbols,
      interval,
    }: {
      strategyId: number
      symbols: string[]
      interval?: string
    }) => {
      const response = await axios.post(
        `${API_BASE}/v1/strategies/${strategyId}/execution/start`,
        { symbols, interval },
        {
          headers: accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : undefined,
        },
      )
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['strategy-execution', variables.strategyId] })
      queryClient.invalidateQueries({ queryKey: ['strategies', variables.strategyId] })
    },
  })
}

export function useStopExecution() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (strategyId: number) => {
      const response = await axios.post(
        `${API_BASE}/v1/strategies/${strategyId}/execution/stop`,
        {},
        {
          headers: accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : undefined,
        },
      )
      return response.data
    },
    onSuccess: (_, strategyId) => {
      queryClient.invalidateQueries({ queryKey: ['strategy-execution', strategyId] })
      queryClient.invalidateQueries({ queryKey: ['strategies', strategyId] })
    },
  })
}

export function useStrategyTrades(strategyId: number, options?: { limit?: number; offset?: number }) {
  const { accessToken } = useAuth()

  return useQuery({
    queryKey: ['strategy-trades', strategyId, options],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (options?.limit) params.append('limit', String(options.limit))
      if (options?.offset) params.append('offset', String(options.offset))

      const response = await axios.get(
        `${API_BASE}/v1/strategies/${strategyId}/trades?${params.toString()}`,
        {
          headers: accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : undefined,
        },
      )
      return response.data.trades as StrategyTrade[]
    },
    enabled: !!accessToken && !!strategyId,
    refetchInterval: 30000,
  })
}

