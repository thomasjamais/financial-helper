import { useBacktestJobs } from '../hooks/useBacktestJobs'

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
}

type BacktestJobsListProps = {
  strategyId?: number
  onJobClick?: (jobId: number) => void
}

export function BacktestJobsList({ strategyId, onJobClick }: BacktestJobsListProps) {
  const { data, isLoading, error } = useBacktestJobs({
    strategyId,
    limit: 20,
    sortBy: 'created_at',
    sortOrder: 'desc',
  })

  if (isLoading) {
    return (
      <div className="p-4 bg-slate-900 rounded-lg">
        <p className="text-slate-400">Loading jobs...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-900/30 border border-red-600 text-red-300 rounded-lg">
        <p>Failed to load jobs: {error instanceof Error ? error.message : 'Unknown error'}</p>
      </div>
    )
  }

  const jobs = data?.jobs ?? []

  if (jobs.length === 0) {
    return (
      <div className="p-4 bg-slate-900 rounded-lg text-center text-slate-400">
        <p>No backtest jobs found</p>
      </div>
    )
  }

  return (
    <div className="bg-slate-900 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-slate-700">
        <h3 className="text-xl font-bold text-white">Backtest Jobs</h3>
        {data?.total && (
          <p className="text-sm text-slate-400 mt-1">Total: {data.total}</p>
        )}
      </div>
      <div className="divide-y divide-slate-700">
        {jobs.map((job) => (
          <div
            key={job.id}
            className={`p-4 hover:bg-slate-800 transition-colors ${
              onJobClick ? 'cursor-pointer' : ''
            }`}
            onClick={() => onJobClick?.(job.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm font-medium text-white">Job #{job.id}</span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      job.status === 'completed'
                        ? 'bg-green-600/20 text-green-400'
                        : job.status === 'failed'
                          ? 'bg-red-600/20 text-red-400'
                          : job.status === 'running'
                            ? 'bg-blue-600/20 text-blue-400'
                            : 'bg-yellow-600/20 text-yellow-400'
                    }`}
                  >
                    {job.status.toUpperCase()}
                  </span>
                </div>
                <div className="text-sm text-slate-400 space-y-1">
                  <p>
                    Symbols: {job.input.symbols.join(', ')} | Interval: {job.input.interval ?? '1h'} | Months:{' '}
                    {job.input.months ?? 6}
                  </p>
                  <p>Created: {formatTimeAgo(new Date(job.created_at))}</p>
                  {job.status === 'running' && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span>Progress</span>
                        <span>{job.progress_pct}%</span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-1.5">
                        <div
                          className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${job.progress_pct}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {job.status === 'failed' && job.error_message && (
                    <p className="text-red-400 text-xs mt-1">Error: {job.error_message}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

