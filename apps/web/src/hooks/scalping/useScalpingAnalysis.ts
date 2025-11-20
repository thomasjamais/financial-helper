import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../lib/api'
import type { ScalpingAnalysis } from '../../types/scalping'

export function useScalpingAnalysis(symbol: string | null) {
  return useQuery({
    queryKey: ['scalping-analysis', symbol],
    queryFn: async () => {
      if (!symbol) {
        throw new Error('Symbol is required')
      }
      const response = await apiClient.get<{ analysis: ScalpingAnalysis }>(
        `/v1/scalping/analyze/${symbol}`,
      )
      return response.data.analysis
    },
    enabled: !!symbol,
    refetchInterval: 60000,
  })
}

