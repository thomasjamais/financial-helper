import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

export function usePortfolioOverview() {
  return useQuery({
    queryKey: ['portfolio', 'binance'],
    queryFn: async () => (await axios.get(`${API_BASE}/v1/binance/portfolio`)).data,
    retry: false,
    refetchInterval: 30000,
  })
}

export function usePortfolioSpot() {
  return useQuery({
    queryKey: ['portfolio', 'binance', 'spot'],
    queryFn: async () => (await axios.get(`${API_BASE}/v1/binance/portfolio/spot`)).data,
    retry: false,
    refetchInterval: 30000,
  })
}

export function usePortfolioEarn() {
  return useQuery({
    queryKey: ['portfolio', 'binance', 'earn'],
    queryFn: async () => (await axios.get(`${API_BASE}/v1/binance/portfolio/earn`)).data,
    retry: false,
    refetchInterval: 30000,
  })
}


