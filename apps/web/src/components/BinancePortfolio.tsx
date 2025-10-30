import { useState } from 'react'
import { useCurrency } from './CurrencyContext'
import { formatNumber } from '../lib/format'
import RebalancePanel from './RebalancePanel'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

type Currency = 'USD' | 'EUR'

type PortfolioAsset = {
  asset: string
  amount: number
  amountLocked?: number
  priceUSD: number
  priceEUR: number
  valueUSD: number
  valueEUR: number
}

type Portfolio = {
  assets: PortfolioAsset[]
  totalValueUSD: number
  totalValueEUR: number
  timestamp: number
}

type ConversionResult = {
  fromAsset: string
  fromAmount: number
  toAsset: string
  toAmount: number
  rate: number
}

function usePortfolio() {
  return useQuery({
    queryKey: ['portfolio', 'binance'],
    queryFn: async () =>
      (
        await axios.get<Portfolio>('/v1/binance/portfolio', {
          baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8080',
        })
      ).data,
    retry: false,
    refetchInterval: 30000,
  })
}

function useConvert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      fromAsset: string
      fromAmount: number
      toAsset: 'BTC' | 'BNB' | 'ETH'
    }) =>
      (
        await axios.post<ConversionResult>('/v1/binance/convert', params, {
          baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8080',
        })
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portfolio'] }),
  })
}

type RebalancingSuggestion = {
  asset: string
  currentAllocation: number
  recommendedAllocation: number
  action: 'BUY' | 'SELL' | 'HOLD'
  reason: string
}

type RebalanceAdvice = {
  suggestions: RebalancingSuggestion[]
  summary: string
  confidence: number
}

function useRebalanceMutation() {
  return useMutation({
    mutationFn: async (params: { mode: 'spot' | 'earn' | 'overview' }) => {
      const res = await axios.post<RebalanceAdvice>(
        '/v1/binance/rebalance',
        params,
        { baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8080' },
      )
      return res.data
    },
  })
}

export function BinancePortfolio() {
  const { currency } = useCurrency()
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null)
  const [convertAmount, setConvertAmount] = useState<string>('')
  const [convertTo, setConvertTo] = useState<'BTC' | 'BNB' | 'ETH'>('BTC')
  const [showRebalance, setShowRebalance] = useState(false)
  const [rebalanceMode, setRebalanceMode] = useState<'spot' | 'earn' | 'overview'>('overview')

  const { data: portfolio, isLoading, error } = usePortfolio()
  const convert = useConvert()
  const rebalance = useRebalanceMutation()

  const totalValue =
    currency === 'USD' ? portfolio?.totalValueUSD : portfolio?.totalValueEUR

  const handleConvert = () => {
    if (!selectedAsset || !convertAmount) return
    const amount = parseFloat(convertAmount)
    if (isNaN(amount) || amount <= 0) return

    convert.mutate(
      {
        fromAsset: selectedAsset,
        fromAmount: amount,
        toAsset: convertTo,
      },
      {
        onSuccess: () => {
          setConvertAmount('')
          alert(
            `Conversion: ${amount} ${selectedAsset} = ${convert.data?.toAmount.toFixed(8)} ${convertTo}`,
          )
        },
        onError: (err: any) => {
          alert(
            err?.response?.data?.error ||
              'Conversion failed. Check your balance.',
          )
        },
      },
    )
  }

  return (
    <div className="space-y-6 bg-slate-900 rounded-lg p-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Binance Portfolio</h2>
      </div>

      {isLoading && <p className="text-slate-400">Loading portfolio...</p>}
      {error && (
        <p className="text-red-400">
          {(error as any)?.response?.data?.error || 'Failed to load portfolio'}
        </p>
      )}

      {portfolio && (
        <>
          <div className="border rounded-lg p-4 bg-gradient-to-br from-blue-600 to-blue-700 border-blue-500">
            <div className="text-sm text-blue-100">Total Portfolio Value</div>
            <div className="text-3xl font-bold text-white">
              {currency === 'USD' ? '$' : '€'}
              {formatNumber(totalValue ?? 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden border-slate-700 bg-slate-800">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700">
                  <tr>
                    <th className="text-left p-3 text-slate-300">Asset</th>
                    <th className="text-right p-3 text-slate-300">Amount</th>
                    <th className="text-right p-3 text-slate-300">Price</th>
                    <th className="text-right p-3 text-slate-300">Value</th>
                    <th className="text-center p-3 text-slate-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.assets.map((asset) => {
                    const price =
                      currency === 'USD' ? asset.priceUSD : asset.priceEUR
                    const value =
                      currency === 'USD' ? asset.valueUSD : asset.valueEUR
                    return (
                      <tr
                        key={asset.asset}
                        className="border-t border-slate-700 hover:bg-slate-800"
                      >
                        <td className="p-3 font-medium text-white">
                          {asset.asset}
                        </td>
                        <td className="p-3 text-right text-slate-300">
                          {formatNumber(asset.amount, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                          {asset.amountLocked &&
                            asset.amountLocked > 0 &&
                            ` (${asset.amountLocked.toFixed(2)} locked)`}
                        </td>
                        <td className="p-3 text-right text-slate-300">
                          {currency === 'USD' ? '$' : '€'}
                          {formatNumber(price, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                        </td>
                        <td className="p-3 text-right font-semibold text-white">
                          {currency === 'USD' ? '$' : '€'}
                          {formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => setSelectedAsset(asset.asset)}
                            className="text-blue-400 hover:text-blue-300 text-sm transition"
                          >
                            Convert
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {selectedAsset && (
            <div className="border rounded-lg p-4 bg-slate-800 border-slate-700">
              <h3 className="font-semibold mb-3 text-white">
                Convert {selectedAsset} to BTC/BNB/ETH
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="number"
                  placeholder="Amount"
                  value={convertAmount}
                  onChange={(e) => setConvertAmount(e.target.value)}
                  className="border border-slate-600 bg-slate-700 text-white p-2 rounded"
                />
                <select
                  value={convertTo}
                  onChange={(e) =>
                    setConvertTo(e.target.value as 'BTC' | 'BNB' | 'ETH')
                  }
                  className="border border-slate-600 bg-slate-700 text-white p-2 rounded"
                >
                  <option value="BTC">BTC</option>
                  <option value="BNB">BNB</option>
                  <option value="ETH">ETH</option>
                </select>
                <button
                  onClick={handleConvert}
                  disabled={convert.isPending || !convertAmount}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 transition"
                >
                  {convert.isPending ? 'Converting...' : 'Convert'}
                </button>
              </div>
              {convert.data && (
                <div className="mt-3 p-2 bg-green-900 border border-green-700 rounded">
                  <div className="text-sm text-green-300">
                    {convert.data.fromAmount} {convert.data.fromAsset} ={' '}
                    {convert.data.toAmount.toFixed(8)} {convert.data.toAsset}
                  </div>
                  <div className="text-xs text-green-400">
                    Rate: 1 {convert.data.fromAsset} ={' '}
                    {convert.data.rate.toFixed(8)} {convert.data.toAsset}
                  </div>
                </div>
              )}
              <button
                onClick={() => {
                  setSelectedAsset(null)
                  setConvertAmount('')
                }}
                className="mt-2 text-sm text-slate-400 hover:text-slate-300"
              >
                Cancel
              </button>
            </div>
          )}

          <RebalancePanel />
        </>
      )}
    </div>
  )
}
