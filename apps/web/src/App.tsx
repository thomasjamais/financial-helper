import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { ExchangeConfigManager } from './components/ExchangeConfigManager'
import { BinancePortfolio } from './components/BinancePortfolio'
import { BinanceSpotOverview } from './components/BinanceSpotOverview'
import { EarnOpportunities } from './components/EarnOpportunities'
import { BinanceEarnOverview } from './components/BinanceEarnOverview'
import StatCard from './components/StatCard'
import { CurrencyProvider, useCurrency } from './components/CurrencyContext'
import { CurrencyToggle } from './components/CurrencyToggle'
import DashboardExchangeCard from './components/DashboardExchangeCard'
import { formatNumber } from './lib/format'

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
  const [subTab, setSubTab] = useState<'full' | 'spot' | 'earn' | 'opps'>(
    'full',
  )
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
          onClick={() => setSubTab('earn')}
          className={`px-3 py-2 text-sm rounded ${
            subTab === 'earn'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-800 text-slate-300'
          }`}
        >
          Earn Overview
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

  const { data: spotPortfolio } = useQuery({
    queryKey: ['portfolio', 'binance', 'spot'],
    queryFn: async () =>
      (await axios.get(`${API_BASE}/v1/binance/portfolio/spot`)).data,
    retry: false,
    refetchInterval: 30000,
  })

  const { data: earnPortfolio } = useQuery({
    queryKey: ['portfolio', 'binance', 'earn'],
    queryFn: async () =>
      (await axios.get(`${API_BASE}/v1/binance/portfolio/earn`)).data,
    retry: false,
    refetchInterval: 30000,
  })

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Portfolio"
          value={`${currency === 'USD' ? '$' : '€'}${formatNumber((currency === 'USD' ? portfolio?.totalValueUSD : portfolio?.totalValueEUR) ?? 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
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

      {/* Exchange Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardExchangeCard
          title="Binance Spot (Top 5)"
          assets={(spotPortfolio?.assets || []).slice(0, 5)}
        />
        <DashboardExchangeCard
          title="Binance Earn (Top 5)"
          assets={(earnPortfolio?.assets || []).slice(0, 5)}
        />
      </div>
    </div>
  )
}

// StatCard moved to components/StatCard

// DashboardExchangeCard moved to components/DashboardExchangeCard
