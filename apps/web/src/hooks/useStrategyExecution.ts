import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../components/AuthContext'
import { apiClient } from '../lib/api'

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
      const response = await apiClient.get(`/v1/strategies/${strategyId}/execution`)
      return response.data.execution as StrategyExecution | null
    },
    enabled: !!accessToken && !!strategyId,
    refetchInterval: 10000,
  })
}

export function useStartExecution() {
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
      const response = await apiClient.post(
        `/v1/strategies/${strategyId}/execution/start`,
        { symbols, interval },
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
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (strategyId: number) => {
      const response = await apiClient.post(`/v1/strategies/${strategyId}/execution/stop`, {})
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

      const response = await apiClient.get(
        `/v1/strategies/${strategyId}/trades?${params.toString()}`,
      )
      return response.data.trades as StrategyTrade[]
    },
    enabled: !!accessToken && !!strategyId,
    refetchInterval: 30000,
  })
}

