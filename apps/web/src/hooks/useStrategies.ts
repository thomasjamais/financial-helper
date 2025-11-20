import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../components/AuthContext'
import { apiClient } from '../lib/api'

export type Strategy = {
  id: number
  name: string
  code: string
  params_schema: unknown
  allocated_amount_usd: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CreateStrategyInput = {
  name: string
  code: string
  params_schema?: unknown
  allocated_amount_usd?: number
}

export type UpdateStrategyInput = {
  name?: string
  code?: string
  params_schema?: unknown
  allocated_amount_usd?: number
  is_active?: boolean
}

export type BacktestInput = {
  symbols: string[]
  interval?: string
  months?: number
  initial_balance?: number
}

export function useStrategies() {
  const { accessToken } = useAuth()

  return useQuery({
    queryKey: ['strategies'],
    queryFn: async () => {
      // Add cache-busting parameter to avoid CloudFront cached errors
      const cacheBuster = `_t=${Date.now()}`
      const response = await apiClient.get(`/v1/strategies?${cacheBuster}`)
      return response.data.strategies as Strategy[]
    },
    enabled: !!accessToken,
  })
}

export function useStrategy(id: number) {
  const { accessToken } = useAuth()

  return useQuery({
    queryKey: ['strategies', id],
    queryFn: async () => {
      const response = await apiClient.get(`/v1/strategies/${id}`)
      return response.data.strategy as Strategy
    },
    enabled: !!id && !!accessToken,
  })
}

export function useCreateStrategy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateStrategyInput) => {
      const response = await apiClient.post('/v1/strategies', input)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategies'] })
    },
  })
}

export function useUpdateStrategy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: number
      input: UpdateStrategyInput
    }) => {
      const response = await apiClient.put(`/v1/strategies/${id}`, input)
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['strategies'] })
      queryClient.invalidateQueries({ queryKey: ['strategies', variables.id] })
    },
  })
}

export function useDeleteStrategy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.delete(`/v1/strategies/${id}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategies'] })
    },
  })
}

export function useUpdateAllocation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      allocated_amount_usd,
    }: {
      id: number
      allocated_amount_usd: number
    }) => {
      const response = await apiClient.put(`/v1/strategies/${id}/allocation`, {
        allocated_amount_usd,
      })
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['strategies'] })
      queryClient.invalidateQueries({ queryKey: ['strategies', variables.id] })
    },
  })
}

export function useBacktest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: BacktestInput }) => {
      const response = await apiClient.post(`/v1/strategies/${id}/backtest`, input)
      return {
        jobId: response.data.jobId as number,
        status: response.data.status as 'pending',
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backtest-jobs'] })
    },
  })
}

export function useDuplicateStrategy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const response = await apiClient.post(`/v1/strategies/${id}/duplicate`, {
        name,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategies'] })
    },
  })
}

export function useExampleStrategies() {
  const { accessToken } = useAuth()

  return useQuery({
    queryKey: ['strategies', 'examples'],
    queryFn: async () => {
      // Add cache-busting parameter to avoid CloudFront cached errors
      const cacheBuster = `_t=${Date.now()}`
      const response = await apiClient.get(`/v1/strategies/examples?${cacheBuster}`)
      return response.data.strategies as Strategy[]
    },
    enabled: !!accessToken,
  })
}
