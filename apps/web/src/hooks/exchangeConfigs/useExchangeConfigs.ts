import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../lib/api'

export type ExchangeConfig = {
  id: number
  exchange: 'bitget' | 'binance'
  label: string
  env: 'paper' | 'live'
  baseUrl?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type CreateExchangeConfigInput = {
  exchange: 'bitget' | 'binance'
  label: string
  key: string
  secret: string
  passphrase?: string
  env: 'paper' | 'live'
  baseUrl?: string
}

export type UpdateExchangeConfigInput = Partial<CreateExchangeConfigInput>

export function useExchangeConfigs() {
  return useQuery({
    queryKey: ['exchange-configs'],
    queryFn: async () => {
      const response = await apiClient.get<{ configs: ExchangeConfig[] }>(
        '/v1/exchange-configs',
      )
      return response.data
    },
    refetchInterval: 5000,
  })
}

export function useCreateExchangeConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateExchangeConfigInput) => {
      const response = await apiClient.post('/v1/exchange-configs', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange-configs'] })
    },
  })
}

export function useUpdateExchangeConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateExchangeConfigInput }) => {
      const response = await apiClient.put(`/v1/exchange-configs/${id}`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange-configs'] })
    },
  })
}

export function useDeleteExchangeConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/v1/exchange-configs/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange-configs'] })
    },
  })
}

export function useActivateExchangeConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.post(`/v1/exchange-configs/${id}/activate`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange-configs'] })
      queryClient.invalidateQueries({ queryKey: ['balances'] })
      queryClient.invalidateQueries({ queryKey: ['portfolio'] })
    },
  })
}

