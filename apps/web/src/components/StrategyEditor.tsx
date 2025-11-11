import { useState, useEffect, useRef } from 'react'
import type { Strategy, CreateStrategyInput, UpdateStrategyInput } from '../hooks/useStrategies'
import { useStrategies, useExampleStrategies } from '../hooks/useStrategies'

type StrategyEditorProps = {
  strategy?: Strategy
  onSave: (input: CreateStrategyInput | UpdateStrategyInput) => Promise<void>
  onCancel?: () => void
}

const DEFAULT_STRATEGY_CODE = `class Strategy {
  name = 'My Strategy'
  
  initialize(candles) {
    // Initialize your strategy here
    // Access indicators via: indicators.sma(), indicators.ema(), etc.
  }
  
  onCandle(candle, index, candles) {
    // Implement your trading logic here
    // Return 'buy', 'sell', or 'hold'
    
    const closes = candles.map(c => c.close)
    const sma20 = indicators.sma(closes, 20)
    const sma50 = indicators.sma(closes, 50)
    
    if (index < 50) return 'hold'
    
    const currentSma20 = sma20[index]
    const currentSma50 = sma50[index]
    const prevSma20 = sma20[index - 1]
    const prevSma50 = sma50[index - 1]
    
    // Golden cross: SMA20 crosses above SMA50
    if (prevSma20 <= prevSma50 && currentSma20 > currentSma50) {
      return 'buy'
    }
    
    // Death cross: SMA20 crosses below SMA50
    if (prevSma20 >= prevSma50 && currentSma20 < currentSma50) {
      return 'sell'
    }
    
    return 'hold'
  }
}`

export function StrategyEditor({ strategy, onSave, onCancel }: StrategyEditorProps) {
  const { data: userStrategies } = useStrategies()
  const { data: exampleStrategies } = useExampleStrategies()
  const [name, setName] = useState(strategy?.name ?? '')
  const [code, setCode] = useState(strategy?.code ?? DEFAULT_STRATEGY_CODE)
  const [allocatedAmount, setAllocatedAmount] = useState(
    strategy?.allocated_amount_usd?.toString() ?? '0',
  )
  const [isSaving, setIsSaving] = useState(false)
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [code])

  async function handleSave() {
    if (!name.trim()) {
      alert('Strategy name is required')
      return
    }

    if (!code.trim()) {
      alert('Strategy code is required')
      return
    }

    setIsSaving(true)
    try {
      const input: CreateStrategyInput | UpdateStrategyInput = {
        name: name.trim(),
        code: code.trim(),
        allocated_amount_usd: Number.parseFloat(allocatedAmount) || 0,
      }

      await onSave(input)
    } catch (error) {
      alert(`Failed to save strategy: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsSaving(false)
    }
  }

  function handleDuplicateFrom(selectedStrategy: Strategy) {
    setCode(selectedStrategy.code)
    setAllocatedAmount(selectedStrategy.allocated_amount_usd.toString())
    if (!strategy) {
      setName(`${selectedStrategy.name} (Copy)`)
    }
    setShowDuplicateModal(false)
  }

  return (
    <div className="space-y-6 bg-slate-900 rounded-lg p-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-white">
          {strategy ? 'Edit Strategy' : 'Create New Strategy'}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="px-4 py-2 bg-slate-700 text-white text-sm rounded hover:bg-slate-600 transition-colors"
          >
            {showHelp ? 'Hide Help' : 'Show Help'}
          </button>
          {!strategy && (
            <button
              onClick={() => setShowDuplicateModal(true)}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
            >
              Duplicate From...
            </button>
          )}
        </div>
      </div>

      {showHelp && (
        <div className="border border-slate-700 rounded-lg p-6 bg-slate-800">
          <h4 className="font-semibold mb-4 text-white text-lg">Strategy Help</h4>
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-medium mb-2 text-slate-200">Strategy Structure:</p>
              <p className="text-slate-300">
                Your strategy must be a class with <code className="bg-slate-700 text-blue-300 px-2 py-1 rounded">initialize(candles)</code> and{' '}
                <code className="bg-slate-700 text-blue-300 px-2 py-1 rounded">onCandle(candle, index, candles)</code> methods.
              </p>
            </div>
            <div>
              <p className="font-medium mb-2 text-slate-200">Available Indicators:</p>
              <ul className="list-disc list-inside text-slate-300 space-y-2 ml-2">
                <li><code className="bg-slate-700 text-blue-300 px-2 py-1 rounded">indicators.sma(array, period)</code> - Simple Moving Average</li>
                <li><code className="bg-slate-700 text-blue-300 px-2 py-1 rounded">indicators.ema(array, period)</code> - Exponential Moving Average</li>
                <li><code className="bg-slate-700 text-blue-300 px-2 py-1 rounded">indicators.rsi(array, period)</code> - Relative Strength Index</li>
                <li><code className="bg-slate-700 text-blue-300 px-2 py-1 rounded">indicators.macd(array)</code> - MACD</li>
                <li><code className="bg-slate-700 text-blue-300 px-2 py-1 rounded">indicators.bollingerBands(array, period, stdDev)</code> - Bollinger Bands</li>
                <li><code className="bg-slate-700 text-blue-300 px-2 py-1 rounded">indicators.atr(highs, lows, closes, period)</code> - Average True Range</li>
                <li><code className="bg-slate-700 text-blue-300 px-2 py-1 rounded">indicators.stochastic(highs, lows, closes, period)</code> - Stochastic Oscillator</li>
              </ul>
            </div>
            <div>
              <p className="font-medium mb-2 text-slate-200">Return Values:</p>
              <p className="text-slate-300">
                The <code className="bg-slate-700 text-blue-300 px-2 py-1 rounded">onCandle</code> method must return <code className="bg-slate-700 text-green-300 px-2 py-1 rounded">'buy'</code>,{' '}
                <code className="bg-slate-700 text-red-300 px-2 py-1 rounded">'sell'</code>, or <code className="bg-slate-700 text-yellow-300 px-2 py-1 rounded">'hold'</code>.
              </p>
            </div>
            <div>
              <p className="font-medium mb-2 text-slate-200">Common Patterns:</p>
              <ul className="list-disc list-inside text-slate-300 space-y-1 ml-2">
                <li>Moving Average Cross: Buy when fast MA crosses above slow MA</li>
                <li>RSI Oversold/Overbought: Buy when RSI &lt; 30, sell when RSI &gt; 70</li>
                <li>Bollinger Bands: Buy when price touches lower band, sell at upper band</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {showDuplicateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Duplicate From Strategy</h3>
              <button
                onClick={() => setShowDuplicateModal(false)}
                className="text-slate-400 hover:text-white text-2xl leading-none"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              {exampleStrategies && exampleStrategies.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 text-slate-200">Example Strategies</h4>
                  <div className="space-y-2">
                    {exampleStrategies.map((example) => (
                      <button
                        key={example.id}
                        onClick={() => handleDuplicateFrom(example)}
                        className="w-full text-left p-3 border border-slate-700 rounded bg-slate-700 hover:bg-slate-600 transition-colors"
                      >
                        <div className="font-medium text-white">{example.name}</div>
                        <div className="text-xs text-slate-400">(Example)</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {userStrategies && userStrategies.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 text-slate-200">Your Strategies</h4>
                  <div className="space-y-2">
                    {userStrategies.map((userStrategy) => (
                      <button
                        key={userStrategy.id}
                        onClick={() => handleDuplicateFrom(userStrategy)}
                        className="w-full text-left p-3 border border-slate-700 rounded bg-slate-700 hover:bg-slate-600 transition-colors"
                      >
                        <div className="font-medium text-white">{userStrategy.name}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {(!exampleStrategies || exampleStrategies.length === 0) &&
                (!userStrategies || userStrategies.length === 0) && (
                  <div className="text-center py-4 text-slate-400">
                    No strategies available to duplicate
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Strategy Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          placeholder="Enter strategy name"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Allocated Amount (USD)</label>
        <input
          type="number"
          value={allocatedAmount}
          onChange={(e) => setAllocatedAmount(e.target.value)}
          min="0"
          step="0.01"
          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          placeholder="0"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Strategy Code</label>
        <textarea
          ref={textareaRef}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm leading-relaxed transition-colors"
          rows={30}
          placeholder="Enter your strategy code"
        />
        <p className="mt-2 text-xs text-slate-400">
          Available indicators: indicators.sma(), indicators.ema(), indicators.rsi(), indicators.macd(), indicators.bollingerBands(), indicators.atr(), indicators.stochastic()
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isSaving ? 'Saving...' : strategy ? 'Update Strategy' : 'Create Strategy'}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-6 py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors font-medium"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

