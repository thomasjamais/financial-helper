import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../lib/api'

export type PortfolioAsset = {
  asset: string
  amount: number
  amountLocked?: number
  priceUSD: number
  priceEUR: number
  valueUSD: number
  valueEUR: number
}

export type Portfolio = {
  assets: PortfolioAsset[]
  totalValueUSD: number
  totalValueEUR: number
  timestamp: number
}

export type ConversionResult = {
  fromAsset: string
  fromAmount: number
  toAsset: string
  toAmount: number
  rate: number
}

export type RebalancingSuggestion = {
  asset: string
  currentAllocation: number
  recommendedAllocation: number
  action: 'BUY' | 'SELL' | 'HOLD'
  reason: string
}

export type RebalanceAdvice = {
  suggestions: RebalancingSuggestion[]
  summary: string
  confidence: number
}

export function usePortfolio() {
  return useQuery({
    queryKey: ['portfolio', 'binance'],
    queryFn: async () =>
      (await apiClient.get<Portfolio>('/v1/binance/portfolio')).data,
    retry: false,
    refetchInterval: 30000,
  })
}

export function useConvert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      fromAsset: string
      fromAmount: number
      toAsset: 'BTC' | 'BNB' | 'ETH'
    }) =>
      (await apiClient.post<ConversionResult>('/v1/binance/convert', params)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portfolio'] }),
  })
}

export function useRebalance() {
  return useMutation({
    mutationFn: async (params: { mode: 'spot' | 'earn' | 'overview' }) => {
      const res = await apiClient.post<RebalanceAdvice>('/v1/binance/rebalance', params)
      return res.data
    },
  })
}

export function validateConversionAmount(amountStr: string): { valid: boolean; amount?: number; error?: string } {
  if (!amountStr || amountStr.trim() === '') {
    return { valid: false, error: 'Amount is required' }
  }
  
  const amount = parseFloat(amountStr)
  
  if (!isFinite(amount)) {
    return { valid: false, error: 'Amount must be a number' }
  }
  
  if (amount <= 0) {
    return { valid: false, error: 'Amount must be greater than 0' }
  }
  
  return { valid: true, amount }
}

