import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useAuth } from './AuthContext'

type ListingAlert = {
  id: number
  event_type: 'IPO' | 'Launchpool' | 'new_listing' | 'delisting'
  symbol: string | null
  title: string
  description: string | null
  announcement_url: string | null
  detected_at: string
  metadata: unknown | null
}

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

function getEventTypeColor(eventType: string): string {
  switch (eventType) {
    case 'new_listing':
      return 'bg-green-600'
    case 'delisting':
      return 'bg-red-600'
    case 'IPO':
      return 'bg-blue-600'
    case 'Launchpool':
      return 'bg-purple-600'
    default:
      return 'bg-slate-600'
  }
}

function getEventTypeLabel(eventType: string): string {
  switch (eventType) {
    case 'new_listing':
      return 'New Listing'
    case 'delisting':
      return 'Delisting'
    case 'IPO':
      return 'IPO'
    case 'Launchpool':
      return 'Launchpool'
    default:
      return eventType
  }
}

export function BinanceListingAlerts() {
  const { accessToken } = useAuth()

  const { data, isLoading, error } = useQuery({
    queryKey: ['binance', 'listing-alerts', 'recent'],
    queryFn: async () => {
      const response = await axios.get<{ alerts: ListingAlert[] }>(
        `${API_BASE}/v1/binance/listing-alerts/recent`,
        {
          params: { limit: 5 },
          headers: accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : undefined,
        },
      )
      return response.data.alerts
    },
    retry: false,
    refetchInterval: 60000,
    enabled: !!accessToken,
  })

  const alerts = data || []

  if (isLoading) {
    return (
      <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">Binance Listing Alerts</h3>
        </div>
        <p className="text-slate-400">Loading alerts...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">Binance Listing Alerts</h3>
        </div>
        <p className="text-red-400">Failed to load alerts</p>
      </div>
    )
  }

  return (
    <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold">Binance Listing Alerts</h3>
        <a
          href="#/listing-alerts"
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          View All
        </a>
      </div>

      {alerts.length === 0 ? (
        <p className="text-slate-400">No recent alerts</p>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-start gap-3 p-3 bg-slate-800 rounded border border-slate-700"
            >
              <span
                className={`px-2 py-1 text-xs font-semibold rounded ${getEventTypeColor(alert.event_type)}`}
              >
                {getEventTypeLabel(alert.event_type)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {alert.symbol && (
                    <span className="font-semibold text-white">{alert.symbol}</span>
                  )}
                  <span className="text-sm text-slate-300">{alert.title}</span>
                </div>
                {alert.description && (
                  <p className="text-xs text-slate-400 mt-1">{alert.description}</p>
                )}
                <p className="text-xs text-slate-500 mt-1">
                  {new Date(alert.detected_at).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

