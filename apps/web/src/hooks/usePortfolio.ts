import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../lib/api'

export function usePortfolioOverview() {
  return useQuery({
    queryKey: ['portfolio', 'binance'],
    queryFn: async () => (await apiClient.get('/v1/binance/portfolio')).data,
    retry: false,
    refetchInterval: 30000,
  })
}

export function usePortfolioSpot() {
  return useQuery({
    queryKey: ['portfolio', 'binance', 'spot'],
    queryFn: async () => (await apiClient.get('/v1/binance/portfolio/spot')).data,
    retry: false,
    refetchInterval: 30000,
  })
}

export function usePortfolioEarn() {
  return useQuery({
    queryKey: ['portfolio', 'binance', 'earn'],
    queryFn: async () => (await apiClient.get('/v1/binance/portfolio/earn')).data,
    retry: false,
    refetchInterval: 30000,
  })
}


