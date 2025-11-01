import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useAuth } from '../components/AuthContext'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

export type TradeIdea = {
  id: number
  exchange: string
  symbol: string
  side: 'BUY' | 'SELL'
  score: number
  reason?: string
  created_at: string
  metadata?: {
    source?: string
    validatedIndicators?: Array<{
      name: string
      side: 'BUY' | 'SELL'
      score: number
      reason: string
      details?: Record<string, any>
    }>
    [key: string]: any
  }
}

export type SortBy = 'score' | 'side' | 'created_at'
export type SortOrder = 'asc' | 'desc'

export function useTradeIdeas(sortBy: SortBy = 'created_at', sortOrder: SortOrder = 'desc') {
  const { accessToken } = useAuth()
  
  return useQuery({
    queryKey: ['trade-ideas', sortBy, sortOrder],
    queryFn: async () =>
      (
        await axios.get<TradeIdea[]>(`${API_BASE}/v1/trade-ideas`, {
          params: { sortBy, sortOrder },
          headers: accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : undefined,
        })
      ).data,
    enabled: !!accessToken,
    refetchInterval: 60000,
  })
}

export type ExecuteTradeIdeaParams = {
  id: number
  budgetUSD: number
  risk: 'moderate'
}

export function useExecuteTradeIdea() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (params: ExecuteTradeIdeaParams) => {
      const response = await axios.post(
        `${API_BASE}/v1/trade-ideas/${params.id}/execute`,
        {
          confirm: true,
          budgetUSD: params.budgetUSD,
          risk: params.risk,
        },
        {
          headers: accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : undefined,
        }
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trade-ideas'] })
      queryClient.invalidateQueries({ queryKey: ['trades'] })
    },
  })
}

export function validateBudget(budgetStr: string | null): { valid: boolean; budget?: number; error?: string } {
  if (!budgetStr) {
    return { valid: false, error: 'Budget is required' }
  }
  
  const budget = Number(budgetStr)
  
  if (!isFinite(budget)) {
    return { valid: false, error: 'Budget must be a number' }
  }
  
  if (budget <= 0) {
    return { valid: false, error: 'Budget must be greater than 0' }
  }
  
  return { valid: true, budget }
}

