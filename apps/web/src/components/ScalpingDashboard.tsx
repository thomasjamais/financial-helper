import { useState } from 'react'
import { PairSelector } from './PairSelector'
import { PairAnalysis } from './PairAnalysis'

export function ScalpingDashboard() {
  const [selectedPair, setSelectedPair] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-3xl font-bold text-white">Scalping Dashboard</h2>
        <span className="px-3 py-1 bg-purple-600 text-white text-sm rounded-full">
          Bitget Futures
        </span>
      </div>

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
    </div>
  )
}

