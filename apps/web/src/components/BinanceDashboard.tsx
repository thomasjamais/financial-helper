import { useQuery } from '@tanstack/react-query'
import { useCurrency } from './CurrencyContext'
import StatCard from './StatCard'
import DashboardExchangeCard from './DashboardExchangeCard'
import { BinanceListingAlerts } from './BinanceListingAlerts'
import { formatNumber } from '../lib/format'
import { apiClient } from '../lib/api'

export function BinanceDashboard() {
  const { currency } = useCurrency()

  const { data: binanceBalances } = useQuery({
    queryKey: ['balances', 'binance'],
    queryFn: async () => (await apiClient.get('/v1/binance/balances')).data,
    retry: false,
    refetchInterval: 30000,
  })

  const { data: portfolio } = useQuery({
    queryKey: ['portfolio', 'binance'],
    queryFn: async () => (await apiClient.get('/v1/binance/portfolio')).data,
    retry: false,
    refetchInterval: 30000,
  })

  const { data: spotPortfolio } = useQuery({
    queryKey: ['portfolio', 'binance', 'spot'],
    queryFn: async () => (await apiClient.get('/v1/binance/portfolio/spot')).data,
    retry: false,
    refetchInterval: 30000,
  })

  const { data: earnPortfolio } = useQuery({
    queryKey: ['portfolio', 'binance', 'earn'],
    queryFn: async () => (await apiClient.get('/v1/binance/portfolio/earn')).data,
    retry: false,
    refetchInterval: 30000,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-3xl font-bold text-white">Binance Dashboard</h2>
        <span className="px-3 py-1 bg-green-600 text-white text-sm rounded-full">
          Spot & Earn
        </span>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Portfolio"
          value={`${currency === 'USD' ? '$' : '€'}${formatNumber((currency === 'USD' ? portfolio?.totalValueUSD : portfolio?.totalValueEUR) ?? 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle={`${portfolio?.assets?.length || 0} assets`}
          color="blue"
          tooltip="Total estimated value across Spot and Earn in the selected currency."
        />
        <StatCard
          title="Binance Spot"
          value={
            binanceBalances?.spot?.length > 0
              ? `${binanceBalances.spot.length} assets`
              : 'Not configured'
          }
          subtitle={
            binanceBalances?.spot
              ?.reduce(
                (sum: number, b: any) => sum + parseFloat(b.free || 0),
                0,
              )
              .toFixed(2) || '0'
          }
          color="green"
          tooltip="Number of assets held in Binance Spot and total free amounts (raw units)."
        />
        <StatCard
          title="Binance Earn"
          value={
            earnPortfolio?.assets?.length > 0
              ? `${earnPortfolio.assets.length} products`
              : 'No positions'
          }
          subtitle={
            earnPortfolio?.totalValueUSD
              ? `${currency === 'USD' ? '$' : '€'}${formatNumber(currency === 'USD' ? earnPortfolio.totalValueUSD : earnPortfolio.totalValueEUR, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : '0'
          }
          color="orange"
          tooltip="Number of Earn products and total value."
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
          title="Binance Spot (Top 5)"
          assets={(spotPortfolio?.assets || []).slice(0, 5)}
          tooltip="Top 5 Spot assets on Binance by value."
        />
        <DashboardExchangeCard
          title="Binance Earn (Top 5)"
          assets={(earnPortfolio?.assets || []).slice(0, 5)}
          tooltip="Top 5 Earn positions on Binance by value."
        />
      </div>

      {/* Listing Alerts */}
      <div className="mt-6">
        <BinanceListingAlerts />
      </div>
    </div>
  )
}

