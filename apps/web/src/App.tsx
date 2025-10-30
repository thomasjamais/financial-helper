import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { ExchangeConfigManager } from './components/ExchangeConfigManager'
import { BinancePortfolio } from './components/BinancePortfolio'
import { BinanceSpotOverview } from './components/BinanceSpotOverview'
import { EarnOpportunities } from './components/EarnOpportunities'
import { BinanceEarnOverview } from './components/BinanceEarnOverview'
import { CurrencyProvider, useCurrency } from './components/CurrencyContext'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: async () => (await axios.get(`${API_BASE}/healthz`)).data,
  })
}

type Tab = 'dashboard' | 'portfolio' | 'configs'

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const { data: health } = useHealth()

  return (
    <CurrencyProvider>
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center font-bold text-xl">
                C
              </div>
              <div>
                <h1 className="text-xl font-bold">Crypto Portfolio</h1>
                <p className="text-xs text-slate-400">
                  {health?.ok ? (
                    <span className="text-green-500">● Connected</span>
                  ) : (
                    <span className="text-red-500">● Disconnected</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs - Mobile Friendly */}
      <nav className="bg-slate-900 border-b border-slate-800">
        <div className="container mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto items-center justify-between">
            <div>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-3 font-medium text-sm whitespace-nowrap transition ${
                activeTab === 'dashboard'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('portfolio')}
              className={`px-4 py-3 font-medium text-sm whitespace-nowrap transition ${
                activeTab === 'portfolio'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Portfolio
            </button>
            <button
              onClick={() => setActiveTab('configs')}
              className={`px-4 py-3 font-medium text-sm whitespace-nowrap transition ${
                activeTab === 'configs'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Configs
            </button>
            </div>
            <CurrencyToggle />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'portfolio' && <PortfolioTab />}
        {activeTab === 'configs' && (
          <div>
            <ExchangeConfigManager />
          </div>
        )}
      </main>
    </div>
    </CurrencyProvider>
  )
}

function PortfolioTab() {
  const [subTab, setSubTab] = useState<'full' | 'spot' | 'earn' | 'opps'>('full')
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setSubTab('full')}
          className={`px-3 py-2 text-sm rounded ${
            subTab === 'full'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-800 text-slate-300'
          }`}
        >
          Full Overview
        </button>
        <button
          onClick={() => setSubTab('spot')}
          className={`px-3 py-2 text-sm rounded ${
            subTab === 'spot'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-800 text-slate-300'
          }`}
        >
          Spot Overview
        </button>
        <button
          onClick={() => setSubTab('opps')}
          className={`px-3 py-2 text-sm rounded ${
            subTab === 'opps'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-800 text-slate-300'
          }`}
        >
          Opportunities
        </button>
        <button
          onClick={() => setSubTab('earn')}
          className={`px-3 py-2 text-sm rounded ${
            subTab === 'earn'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-800 text-slate-300'
          }`}
        >
          Earn Overview
        </button>
      </div>
      {subTab === 'full' && <BinancePortfolio />}
      {subTab === 'spot' && <BinanceSpotOverview />}
      {subTab === 'earn' && <BinanceEarnOverview />}
      {subTab === 'opps' && <EarnOpportunities />}
    </div>
  )
}

function DashboardView() {
  const { currency } = useCurrency()
  const { data: bitgetBalances } = useQuery({
    queryKey: ['balances', 'bitget'],
    queryFn: async () => (await axios.get(`${API_BASE}/v1/balances`)).data,
    retry: false,
    refetchInterval: 30000,
  })

  const { data: binanceBalances } = useQuery({
    queryKey: ['balances', 'binance'],
    queryFn: async () =>
      (await axios.get(`${API_BASE}/v1/binance/balances`)).data,
    retry: false,
    refetchInterval: 30000,
  })

  const { data: portfolio } = useQuery({
    queryKey: ['portfolio', 'binance'],
    queryFn: async () =>
      (await axios.get(`${API_BASE}/v1/binance/portfolio`)).data,
    retry: false,
    refetchInterval: 30000,
  })

  const { data: earnPortfolio } = useQuery({
    queryKey: ['portfolio', 'binance', 'earn'],
    queryFn: async () => (await axios.get(`${API_BASE}/v1/binance/portfolio/earn`)).data,
    retry: false,
    refetchInterval: 30000,
  })

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Portfolio"
          value={`${currency === 'USD' ? '$' : '€'}${
            (currency === 'USD' ? portfolio?.totalValueUSD : portfolio?.totalValueEUR)?.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }) || '0.00'
          }`}
          subtitle={portfolio?.assets?.length || 0 + ' assets'}
          color="blue"
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
        />
        <StatCard
          title="Bitget Spot"
          value={
            bitgetBalances?.spot?.length > 0
              ? `${bitgetBalances.spot.length} assets`
              : 'Not configured'
          }
          subtitle={
            bitgetBalances?.spot
              ?.reduce(
                (sum: number, b: any) => sum + parseFloat(b.free || 0),
                0,
              )
              .toFixed(2) || '0'
          }
          color="purple"
        />
        <StatCard
          title="Last Update"
          value={new Date().toLocaleTimeString()}
          subtitle="Auto-refresh: 30s"
          color="orange"
        />
      </div>

      {/* Exchange Balances */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ExchangeBalanceCard
          exchange="Binance"
          balances={binanceBalances}
          color="green"
        />
        <ExchangeBalanceCard
          exchange="Bitget"
          balances={bitgetBalances}
          color="purple"
        />
      </div>

      {/* Binance Earn Snapshot */}
      <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
        <h3 className="text-xl font-bold mb-4">Binance Earn (Top 5)</h3>
        <SmallPortfolioTable assets={(earnPortfolio?.assets || []).slice(0, 5)} currency={currency} />
      </div>
    </div>
  )
}

function CurrencyToggle() {
  const { currency, setCurrency } = useCurrency()
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-slate-400">Currency:</span>
      <button onClick={() => setCurrency('USD')} className={`px-3 py-1 rounded ${currency === 'USD' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'}`}>USD</button>
      <button onClick={() => setCurrency('EUR')} className={`px-3 py-1 rounded ${currency === 'EUR' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'}`}>EUR</button>
    </div>
  )
}

function SmallPortfolioTable({ assets, currency }: { assets: any[]; currency: 'USD' | 'EUR' }) {
  return (
    <div className="border rounded-lg overflow-hidden border-slate-700 bg-slate-800">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-700">
            <tr>
              <th className="text-left p-3 text-slate-300">Asset</th>
              <th className="text-right p-3 text-slate-300">Amount</th>
              <th className="text-right p-3 text-slate-300">Price</th>
              <th className="text-right p-3 text-slate-300">Value</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.asset} className="border-t border-slate-700">
                <td className="p-3 text-white">{a.asset}</td>
                <td className="p-3 text-right text-slate-300">{a.amount.toFixed(6)}</td>
                <td className="p-3 text-right text-slate-300">{currency === 'USD' ? '$' : '€'}{(currency === 'USD' ? a.priceUSD : a.priceEUR).toFixed(4)}</td>
                <td className="p-3 text-right text-slate-300">{currency === 'USD' ? '$' : '€'}{(currency === 'USD' ? a.valueUSD : a.valueEUR).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  subtitle,
  color,
}: {
  title: string
  value: string
  subtitle: string
  color: 'blue' | 'green' | 'purple' | 'orange'
}) {
  const colorClasses = {
    blue: 'bg-gradient-to-br from-blue-600 to-blue-700',
    green: 'bg-gradient-to-br from-green-600 to-green-700',
    purple: 'bg-gradient-to-br from-purple-600 to-purple-700',
    orange: 'bg-gradient-to-br from-orange-600 to-orange-700',
  }

  return (
    <div className={`${colorClasses[color]} rounded-lg p-5 shadow-lg`}>
      <div className="text-sm opacity-90 mb-1">{title}</div>
      <div className="text-2xl font-bold mb-1">{value}</div>
      <div className="text-xs opacity-75">{subtitle}</div>
    </div>
  )
}

function ExchangeBalanceCard({
  exchange,
  balances,
  color,
}: {
  exchange: string
  balances: any
  color: 'green' | 'purple'
}) {
  const spot = balances?.spot || []
  const futures = balances?.futures || []
  const hasData = spot.length > 0 || futures.length > 0
  const colorClasses = {
    green: 'border-green-500',
    purple: 'border-purple-500',
  }

  return (
    <div
      className={`bg-slate-900 rounded-lg p-6 border-2 ${colorClasses[color]}`}
    >
      <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
        <span
          className={`w-3 h-3 rounded-full ${
            hasData ? 'bg-green-500' : 'bg-gray-500'
          }`}
        ></span>
        {exchange} Balances
      </h3>
      {!hasData ? (
        <div className="text-slate-400 text-center py-8">
          No balances. Configure {exchange} in Configs tab.
        </div>
      ) : (
        <div className="space-y-4">
          {spot.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-400 mb-2">
                Spot
              </h4>
              <div className="space-y-2">
                {spot.slice(0, 5).map((b: any) => (
                  <div
                    key={b.asset}
                    className="flex justify-between items-center p-2 bg-slate-800 rounded"
                  >
                    <span className="font-medium">{b.asset}</span>
                    <span className="text-slate-300">
                      {Number(b.free).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 8,
                      })}
                    </span>
                  </div>
                ))}
                {spot.length > 5 && (
                  <div className="text-xs text-slate-500 text-center">
                    +{spot.length - 5} more
                  </div>
                )}
              </div>
            </div>
          )}
          {futures.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-400 mb-2">
                Futures
              </h4>
              <div className="space-y-2">
                {futures.map((b: any) => (
                  <div
                    key={b.asset}
                    className="flex justify-between items-center p-2 bg-slate-800 rounded"
                  >
                    <span className="font-medium">{b.asset}</span>
                    <span className="text-slate-300">
                      {Number(b.free).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 8,
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
