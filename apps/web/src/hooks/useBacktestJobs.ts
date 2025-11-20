import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../components/AuthContext'
import { apiClient } from '../lib/api'

export type BacktestJobStatus = 'pending' | 'running' | 'completed' | 'failed'

export type BacktestJob = {
  id: number
  user_id: string
  strategy_id: number
  status: BacktestJobStatus
  input: {
    symbols: string[]
    interval?: string
    months?: number
    initial_balance?: number
  }
  result_id: number | null
  error_message: string | null
  progress_pct: number
  created_at: string
  started_at: string | null
  completed_at: string | null
}

export type BacktestResult = {
  id: number
  strategy_id: number
  symbols: string[]
  start_date: string
  end_date: string
  metrics: unknown
  results_json: unknown
  created_at: string
}

export function useBacktestJobs(options?: {
  strategyId?: number
  status?: BacktestJobStatus
  limit?: number
  offset?: number
  sortBy?: 'created_at' | 'status'
  sortOrder?: 'asc' | 'desc'
}) {
  const { accessToken } = useAuth()

  return useQuery({
    queryKey: ['backtest-jobs', options],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (options?.strategyId) params.append('strategy_id', String(options.strategyId))
      if (options?.status) params.append('status', options.status)
      if (options?.limit) params.append('limit', String(options.limit))
      if (options?.offset) params.append('offset', String(options.offset))
      if (options?.sortBy) params.append('sort_by', options.sortBy)
      if (options?.sortOrder) params.append('sort_order', options.sortOrder)

      const response = await apiClient.get(`/v1/backtest-jobs?${params.toString()}`)
      return {
        jobs: response.data.jobs as BacktestJob[],
        total: response.data.total as number,
      }
    },
    enabled: !!accessToken,
    refetchInterval: (query) => {
      const jobs = query.state.data?.jobs ?? []
      const hasPendingOrRunning = jobs.some(
        (job) => job.status === 'pending' || job.status === 'running',
      )
      return hasPendingOrRunning ? 3000 : false
    },
  })
}

export function useBacktestJob(jobId: number) {
  const { accessToken } = useAuth()

  return useQuery({
    queryKey: ['backtest-jobs', jobId],
    queryFn: async () => {
      const response = await apiClient.get(`/v1/backtest-jobs/${jobId}`)
      return response.data.job as BacktestJob
    },
    enabled: !!accessToken && !!jobId,
    refetchInterval: (query) => {
      const job = query.state.data
      return job && (job.status === 'pending' || job.status === 'running') ? 3000 : false
    },
  })
}

export function useBacktestJobResult(jobId: number) {
  const { accessToken } = useAuth()

  return useQuery({
    queryKey: ['backtest-jobs', jobId, 'result'],
    queryFn: async () => {
      const response = await apiClient.get(`/v1/backtest-jobs/${jobId}/result`)
      return response.data.result as BacktestResult
    },
    enabled: !!accessToken && !!jobId,
  })
}

export function useBacktestResults(strategyId: number, options?: { limit?: number; offset?: number }) {
  const { accessToken } = useAuth()

  return useQuery({
    queryKey: ['backtest-results', strategyId, options],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (options?.limit) params.append('limit', String(options.limit))
      if (options?.offset) params.append('offset', String(options.offset))

      const response = await apiClient.get(
        `/v1/strategies/${strategyId}/backtests?${params.toString()}`,
      )
      return response.data.results as BacktestResult[]
    },
    enabled: !!accessToken && !!strategyId,
  })
}

