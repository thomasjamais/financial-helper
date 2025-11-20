import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../lib/api'

export interface ScalpingStrategy {
  id: number
  userId: string
  exchange: 'bitget' | 'binance'
  symbol: string
  maxCapital: number
  leverage: number
  riskPerTrade: number
  minConfidence: number
  maxOpenPositions: number
  isActive: boolean
  feeRate: number
  slippageBps: number
  createdAt: string
  updatedAt: string
}

export interface ScalpingStrategyFormData {
  exchange: 'bitget' | 'binance'
  symbol: string
  maxCapital: number
  leverage: number
  riskPerTrade: number
  minConfidence: number
  maxOpenPositions: number
  feeRate: number
  slippageBps: number
}

export function useScalpingStrategies() {
  return useQuery({
    queryKey: ['scalping-strategies'],
    queryFn: async () => {
      const response = await apiClient.get<{ strategies: ScalpingStrategy[] }>(
        '/v1/scalping/strategies',
      )
      return response.data.strategies
    },
    refetchInterval: 10000,
  })
}

export function useCreateScalpingStrategy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: ScalpingStrategyFormData) => {
      const response = await apiClient.post<{ strategy: ScalpingStrategy }>(
        '/v1/scalping/strategies',
        data,
      )
      return response.data.strategy
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scalping-strategies'] })
    },
  })
}

export function useUpdateScalpingStrategy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number
      data: Partial<ScalpingStrategyFormData> & { isActive?: boolean }
    }) => {
      const response = await apiClient.put<{ strategy: ScalpingStrategy }>(
        `/v1/scalping/strategies/${id}`,
        data,
      )
      return response.data.strategy
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scalping-strategies'] })
    },
  })
}

export function useDeleteScalpingStrategy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/v1/scalping/strategies/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scalping-strategies'] })
    },
  })
}

export function useToggleScalpingStrategy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const response = await apiClient.put<{ strategy: ScalpingStrategy }>(
        `/v1/scalping/strategies/${id}`,
        { isActive },
      )
      return response.data.strategy
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scalping-strategies'] })
    },
  })
}

