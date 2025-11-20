import { useState } from 'react'
import { PairSelector } from './PairSelector'
import { PairAnalysis } from './PairAnalysis'
import { ScalpingStrategies } from './ScalpingStrategies'

export function ScalpingDashboard() {
  const [selectedPair, setSelectedPair] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'analysis' | 'strategies'>(
    'analysis',
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-3xl font-bold text-white">Scalping Dashboard</h2>
          <span className="px-3 py-1 bg-purple-600 text-white text-sm rounded-full">
            Bitget Futures
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('analysis')}
            className={`px-4 py-2 rounded transition ${
              activeTab === 'analysis'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Analysis
          </button>
          <button
            onClick={() => setActiveTab('strategies')}
            className={`px-4 py-2 rounded transition ${
              activeTab === 'strategies'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Automated Strategies
          </button>
        </div>
      </div>

      {activeTab === 'analysis' && (
        <>
          <PairSelector
            onSelectPair={setSelectedPair}
            selectedPair={selectedPair}
          />

          {selectedPair && (
            <div className="mt-6">
              <PairAnalysis symbol={selectedPair} />
            </div>
          )}

          {!selectedPair && (
            <div className="bg-slate-900 rounded-lg p-8 text-center">
              <div className="text-slate-400 text-lg">
                Select a pair above to view scalping analysis
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'strategies' && <ScalpingStrategies />}
    </div>
  )
}
