import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useAuth } from '../components/AuthContext'

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

type EventTypeFilter = 'all' | 'IPO' | 'Launchpool' | 'new_listing' | 'delisting'

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

export default function BinanceListingAlertsPage() {
  const { accessToken } = useAuth()
  const [eventTypeFilter, setEventTypeFilter] = useState<EventTypeFilter>('all')
  const [page, setPage] = useState(0)
  const limit = 50

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['binance', 'listing-alerts', eventTypeFilter, page],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        limit,
        offset: page * limit,
      }
      if (eventTypeFilter !== 'all') {
        params.eventType = eventTypeFilter
      }

      const response = await axios.get<{ alerts: ListingAlert[] }>(
        `${API_BASE}/v1/binance/listing-alerts`,
        {
          params,
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              window.location.hash = '#/dashboard'
            }}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm"
          >
            ← Back
          </button>
          <h1 className="text-3xl font-bold">Binance Listing Alerts</h1>
        </div>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
        >
          Refresh
        </button>
      </div>

      <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
        <div className="flex items-center gap-4 mb-6">
          <label className="text-sm font-semibold text-slate-300">Filter by type:</label>
          <select
            value={eventTypeFilter}
            onChange={(e) => {
              setEventTypeFilter(e.target.value as EventTypeFilter)
              setPage(0)
            }}
            className="px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded"
          >
            <option value="all">All</option>
            <option value="new_listing">New Listing</option>
            <option value="delisting">Delisting</option>
            <option value="IPO">IPO</option>
            <option value="Launchpool">Launchpool</option>
          </select>
        </div>

        {isLoading && <p className="text-slate-400">Loading alerts...</p>}
        {error && <p className="text-red-400">Failed to load alerts</p>}

        {!isLoading && !error && (
          <>
            {alerts.length === 0 ? (
              <p className="text-slate-400">No alerts found</p>
            ) : (
              <div className="border rounded-lg overflow-hidden border-slate-700 bg-slate-800">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-700">
                      <tr>
                        <th className="text-left p-3 text-slate-300">Type</th>
                        <th className="text-left p-3 text-slate-300">Symbol</th>
                        <th className="text-left p-3 text-slate-300">Title</th>
                        <th className="text-left p-3 text-slate-300">Description</th>
                        <th className="text-left p-3 text-slate-300">Detected At</th>
                        <th className="text-left p-3 text-slate-300">Link</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alerts.map((alert) => (
                        <tr
                          key={alert.id}
                          className="border-t border-slate-700 hover:bg-slate-800"
                        >
                          <td className="p-3">
                            <span
                              className={`px-2 py-1 text-xs font-semibold rounded ${getEventTypeColor(alert.event_type)}`}
                            >
                              {getEventTypeLabel(alert.event_type)}
                            </span>
                          </td>
                          <td className="p-3 text-white font-semibold">
                            {alert.symbol || '-'}
                          </td>
                          <td className="p-3 text-slate-300">{alert.title}</td>
                          <td className="p-3 text-slate-400 text-sm">
                            {alert.description || '-'}
                          </td>
                          <td className="p-3 text-slate-400 text-sm">
                            {new Date(alert.detected_at).toLocaleString()}
                          </td>
                          <td className="p-3">
                            {alert.announcement_url ? (
                              <a
                                href={alert.announcement_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 text-sm"
                              >
                                View
                              </a>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mt-4">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-slate-400">Page {page + 1}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={alerts.length < limit}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

