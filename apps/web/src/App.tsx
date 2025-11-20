import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { ExchangeConfigManager } from './components/ExchangeConfigManager'
import { BinancePortfolio } from './components/BinancePortfolio'
import { BinanceSpotOverview } from './components/BinanceSpotOverview'
import { EarnOpportunities } from './components/EarnOpportunities'
import { BinanceEarnOverview } from './components/BinanceEarnOverview'
import StatCard from './components/StatCard'
import { CurrencyProvider, useCurrency } from './components/CurrencyContext'
import AiTrades from './components/AiTrades'
import Signals from './components/Signals'
import TradeIdeas from './components/TradeIdeas'
import Trades from './components/Trades'
import TradeDetail from './components/TradeDetail'
import { AuthProvider } from './components/AuthContext'
import Protected from './components/Protected'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Profile from './pages/Profile'
import UsersAdmin from './pages/UsersAdmin'
import { CurrencyToggle } from './components/CurrencyToggle'
import DashboardExchangeCard from './components/DashboardExchangeCard'
import { formatNumber } from './lib/format'
import StrategiesPage from './pages/StrategiesPage'
import { BinanceListingAlerts } from './components/BinanceListingAlerts'
import BinanceListingAlertsPage from './pages/BinanceListingAlertsPage'
import { BinanceDashboard } from './components/BinanceDashboard'
import { BitgetDashboard } from './components/BitgetDashboard'
import { ScalpingDashboard } from './components/ScalpingDashboard'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: async () => (await axios.get(`${API_BASE}/healthz`)).data,
  })
}

type Tab =
  | 'dashboard'
  | 'portfolio'
  | 'ai'
  | 'ideas'
  | 'trades'
  | 'signals'
  | 'configs'
  | 'strategies'
  | 'scalping'

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const { data: health } = useHealth()
  const [route, setRoute] = useState<string>(location.hash)
  const isAuthPage = route === '#/login' || route === '#/signup'

  useEffect(() => {
    const onHashChange = () => {
      const hash = location.hash
      setRoute(hash)
      // Handle tab activation based on route
      if (hash === '' || hash === '#') {
        setActiveTab('dashboard')
      } else if (hash === '#/trades') {
        setActiveTab('trades')
      } else if (hash.startsWith('#/trade/')) {
        // Keep trades tab active when viewing trade detail
        setActiveTab('trades')
      }
    }
    window.addEventListener('hashchange', onHashChange)
    // Initial call
    onHashChange()
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  return (
    <CurrencyProvider>
      <AuthProvider>
        <div className="min-h-screen bg-slate-950 text-white">
          {isAuthPage ? (
            <main className="container mx-auto px-4 py-6">
              {route === '#/login' && <Login />}
              {route === '#/signup' && <Signup />}
            </main>
          ) : (
            <Protected>
              <div>
                {/* Header */}
                <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
                  <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center font-bold text-xl">
                          C
                        </div>
                        <div>
                          <h1 className="text-xl font-bold">
                            Crypto Portfolio
                          </h1>
                          <p className="text-xs text-slate-400">
                            {health?.ok ? (
                              <span className="text-green-500">
                                ● Connected
                              </span>
                            ) : (
                              <span className="text-red-500">
                                ● Disconnected
                              </span>
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
                          onClick={() => setActiveTab('ai')}
                          className={`px-4 py-3 font-medium text-sm whitespace-nowrap transition ${
                            activeTab === 'ai'
                              ? 'text-blue-400 border-b-2 border-blue-400'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          AI Trades
                        </button>
                        <button
                          onClick={() => setActiveTab('signals')}
                          className={`px-4 py-3 font-medium text-sm whitespace-nowrap transition ${
                            activeTab === 'signals'
                              ? 'text-blue-400 border-b-2 border-blue-400'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Signals
                        </button>
                        <button
                          onClick={() => setActiveTab('ideas')}
                          className={`px-4 py-3 font-medium text-sm whitespace-nowrap transition ${
                            activeTab === 'ideas'
                              ? 'text-blue-400 border-b-2 border-blue-400'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Trade Ideas
                        </button>
                        <button
                          onClick={() => setActiveTab('trades')}
                          className={`px-4 py-3 font-medium text-sm whitespace-nowrap transition ${
                            activeTab === 'trades'
                              ? 'text-blue-400 border-b-2 border-blue-400'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Trades
                        </button>
                        <button
                          onClick={() => setActiveTab('strategies')}
                          className={`px-4 py-3 font-medium text-sm whitespace-nowrap transition ${
                            activeTab === 'strategies'
                              ? 'text-blue-400 border-b-2 border-blue-400'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Strategies
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
                        <button
                          onClick={() => setActiveTab('scalping')}
                          className={`px-4 py-3 font-medium text-sm whitespace-nowrap transition ${
                            activeTab === 'scalping'
                              ? 'text-blue-400 border-b-2 border-blue-400'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Scalping
                        </button>
                      </div>
                      <CurrencyToggle />
                    </div>
                  </div>
                </nav>

                {/* Main Content */}
                <main className="container mx-auto px-4 py-6">
                  {/* Route-based pages (exclusive - don't render tab content when these are active) */}
                  {route === '#/profile' && <Profile />}
                  {route === '#/users' && <UsersAdmin />}
                  {route === '#/listing-alerts' && <BinanceListingAlertsPage />}
                  {route.startsWith('#/trade/') && (
                    <TradeDetail
                      tradeId={Number(route.replace('#/trade/', ''))}
                    />
                  )}
                  {/* Tab-based pages (only render if no route-based page is active) */}
                  {route !== '#/profile' &&
                    route !== '#/users' &&
                    route !== '#/listing-alerts' &&
                    !route.startsWith('#/trade/') && (
                      <>
                        {activeTab === 'dashboard' && <DashboardView />}
                        {activeTab === 'portfolio' && <PortfolioTab />}
                        {activeTab === 'ai' && <AiTrades />}
                        {activeTab === 'signals' && <Signals />}
                        {activeTab === 'trades' && <Trades />}
                        {activeTab === 'ideas' && <TradeIdeas />}
                        {activeTab === 'strategies' && <StrategiesPage />}
                        {activeTab === 'configs' && (
                          <div>
                            <ExchangeConfigManager />
                          </div>
                        )}
                        {activeTab === 'scalping' && <ScalpingDashboard />}
                      </>
                    )}
                </main>
              </div>
            </Protected>
          )}
        </div>
      </AuthProvider>
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
  return (
    <div className="space-y-8">
      <BinanceDashboard />
      <div className="border-t border-slate-700 pt-8">
        <BitgetDashboard />
      </div>
    </div>
  )
}

// StatCard moved to components/StatCard

// DashboardExchangeCard moved to components/DashboardExchangeCard
