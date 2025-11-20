import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useCurrency } from './CurrencyContext'
import StatCard from './StatCard'
import DashboardExchangeCard from './DashboardExchangeCard'
import { formatNumber } from '../lib/format'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

export function BitgetDashboard() {
  const { currency } = useCurrency()

  const { data: bitgetBalances } = useQuery({
    queryKey: ['balances', 'bitget'],
    queryFn: async () => (await axios.get(`${API_BASE}/v1/balances`)).data,
    retry: false,
    refetchInterval: 30000,
  })

  const { data: bitgetPositions } = useQuery({
    queryKey: ['positions', 'bitget'],
    queryFn: async () => (await axios.get(`${API_BASE}/v1/positions`)).data,
    retry: false,
    refetchInterval: 30000,
  })

  const spotBalances = bitgetBalances?.spot || []
  const futuresBalances = bitgetBalances?.futures || []
  const positions = bitgetPositions?.positions || []

  const totalSpotValue = spotBalances.reduce(
    (sum: number, b: any) => sum + parseFloat(b.free || 0),
    0,
  )

  const totalFuturesValue = futuresBalances.reduce(
    (sum: number, b: any) => sum + parseFloat(b.free || 0),
    0,
  )

  const openPositionsPnL = positions.reduce(
    (sum: number, p: any) => sum + (parseFloat(p.unrealizedPnl || 0)),
    0,
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-3xl font-bold text-white">Bitget Dashboard</h2>
        <span className="px-3 py-1 bg-purple-600 text-white text-sm rounded-full">
          Spot & Futures
        </span>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Bitget Spot"
          value={
            spotBalances.length > 0
              ? `${spotBalances.length} assets`
              : 'Not configured'
          }
          subtitle={`${totalSpotValue.toFixed(2)} total units`}
          color="purple"
          tooltip="Number of assets held in Bitget Spot and total free amounts (raw units)."
        />
        <StatCard
          title="Bitget Futures"
          value={
            futuresBalances.length > 0
              ? `${futuresBalances.length} assets`
              : 'Not configured'
          }
          subtitle={`${totalFuturesValue.toFixed(2)} total units`}
          color="purple"
          tooltip="Number of assets in Bitget Futures account and total free amounts (raw units)."
        />
        <StatCard
          title="Open Positions"
          value={
            positions.length > 0
              ? `${positions.length} positions`
              : 'No positions'
          }
          subtitle={
            openPositionsPnL !== 0
              ? `${openPositionsPnL > 0 ? '+' : ''}${formatNumber(openPositionsPnL, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT PnL`
              : '0 USDT'
          }
          color={openPositionsPnL >= 0 ? 'green' : 'orange'}
          tooltip="Number of open futures positions and total unrealized PnL."
        />
        <StatCard
          title="Last Update"
          value={new Date().toLocaleTimeString()}
          subtitle="Auto-refresh: 30s"
          color="orange"
          tooltip="Time when data was last fetched. Values refresh automatically every 30 seconds."
        />
      </div>

      {/* Exchange Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardExchangeCard
          title="Bitget Spot (Top 5)"
          assets={spotBalances
            .filter((b: any) => parseFloat(b.free || 0) > 0)
            .sort((a: any, b: any) => parseFloat(b.free || 0) - parseFloat(a.free || 0))
            .slice(0, 5)
            .map((b: any) => ({
              asset: b.asset,
              amount: parseFloat(b.free || 0),
              valueUSD: parseFloat(b.free || 0),
              valueEUR: parseFloat(b.free || 0),
              priceUSD: 1,
              priceEUR: 1,
            }))}
          tooltip="Top 5 Spot assets on Bitget by free balance."
        />
        {positions.length > 0 && (
          <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <h3 className="text-xl font-bold mb-4 text-white">
              Open Futures Positions
            </h3>
            <div className="space-y-2">
              {positions.slice(0, 5).map((pos: any, idx: number) => (
                <div
                  key={idx}
                  className="flex justify-between items-center p-3 bg-slate-800 rounded border border-slate-700"
                >
                  <div>
                    <div className="font-semibold text-white">{pos.symbol}</div>
                    <div className="text-sm text-slate-400">
                      {pos.side} • {parseFloat(pos.size || 0).toFixed(4)} contracts
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`font-semibold ${
                        parseFloat(pos.unrealizedPnl || 0) >= 0
                          ? 'text-green-400'
                          : 'text-red-400'
                      }`}
                    >
                      {parseFloat(pos.unrealizedPnl || 0) >= 0 ? '+' : ''}
                      {formatNumber(parseFloat(pos.unrealizedPnl || 0), {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      USDT
                    </div>
                    <div className="text-sm text-slate-400">
                      Entry: {parseFloat(pos.avgPrice || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

