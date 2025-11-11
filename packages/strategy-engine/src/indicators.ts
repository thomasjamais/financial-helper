import type { Candle } from './types'

export function sma(values: number[], period: number): number[] {
  const result: number[] = []
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(NaN)
    } else {
      const slice = values.slice(i - period + 1, i + 1)
      const sum = slice.reduce((a, b) => a + b, 0)
      result.push(sum / period)
    }
  }
  return result
}

export function ema(values: number[], period: number): number[] {
  const result: number[] = []
  const multiplier = 2 / (period + 1)
  
  for (let i = 0; i < values.length; i++) {
    if (i === 0) {
      result.push(values[i])
    } else {
      const prevEma = result[i - 1]
      const currentEma = (values[i] - prevEma) * multiplier + prevEma
      result.push(currentEma)
    }
  }
  return result
}

export function rsi(values: number[], period: number = 14): number[] {
  const result: number[] = []
  const deltas: number[] = []
  
  for (let i = 1; i < values.length; i++) {
    deltas.push(values[i] - values[i - 1])
  }
  
  for (let i = 0; i < values.length; i++) {
    if (i < period) {
      result.push(NaN)
    } else {
      const slice = deltas.slice(i - period, i)
      const gains = slice.filter(d => d > 0)
      const losses = slice.filter(d => d < 0).map(d => Math.abs(d))
      
      const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0
      const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0
      
      if (avgLoss === 0) {
        result.push(100)
      } else {
        const rs = avgGain / avgLoss
        const rsiValue = 100 - (100 / (1 + rs))
        result.push(rsiValue)
      }
    }
  }
  
  return result
}

export function macd(
  values: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9,
): { macd: number[]; signal: number[]; histogram: number[] } {
  const fastEma = ema(values, fastPeriod)
  const slowEma = ema(values, slowPeriod)
  
  const macdLine: number[] = []
  for (let i = 0; i < values.length; i++) {
    if (isNaN(fastEma[i]) || isNaN(slowEma[i])) {
      macdLine.push(NaN)
    } else {
      macdLine.push(fastEma[i] - slowEma[i])
    }
  }
  
  const signalLine = ema(macdLine.filter(v => !isNaN(v)), signalPeriod)
  const histogram: number[] = []
  
  for (let i = 0; i < macdLine.length; i++) {
    if (isNaN(macdLine[i])) {
      histogram.push(NaN)
    } else {
      const signalIdx = i - (macdLine.length - signalLine.length)
      if (signalIdx >= 0 && signalIdx < signalLine.length) {
        histogram.push(macdLine[i] - signalLine[signalIdx])
      } else {
        histogram.push(NaN)
      }
    }
  }
  
  return { macd: macdLine, signal: signalLine, histogram }
}

export function bollingerBands(
  values: number[],
  period: number = 20,
  stdDev: number = 2,
): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = sma(values, period)
  const upper: number[] = []
  const lower: number[] = []
  
  for (let i = 0; i < values.length; i++) {
    if (isNaN(middle[i])) {
      upper.push(NaN)
      lower.push(NaN)
    } else {
      const slice = values.slice(i - period + 1, i + 1)
      const mean = middle[i]
      const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period
      const standardDeviation = Math.sqrt(variance)
      
      upper.push(mean + stdDev * standardDeviation)
      lower.push(mean - stdDev * standardDeviation)
    }
  }
  
  return { upper, middle, lower }
}

export function atr(candles: Candle[], period: number = 14): number[] {
  const trueRanges: number[] = []
  
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high
    const low = candles[i].low
    const prevClose = candles[i - 1].close
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose),
    )
    trueRanges.push(tr)
  }
  
  const result: number[] = [NaN]
  for (let i = 0; i < trueRanges.length; i++) {
    if (i < period - 1) {
      result.push(NaN)
    } else {
      const slice = trueRanges.slice(i - period + 1, i + 1)
      const avg = slice.reduce((a, b) => a + b, 0) / period
      result.push(avg)
    }
  }
  
  return result
}

export function stochastic(
  candles: Candle[],
  kPeriod: number = 14,
  dPeriod: number = 3,
): { k: number[]; d: number[] } {
  const kValues: number[] = []
  
  for (let i = 0; i < candles.length; i++) {
    if (i < kPeriod - 1) {
      kValues.push(NaN)
    } else {
      const slice = candles.slice(i - kPeriod + 1, i + 1)
      const highest = Math.max(...slice.map(c => c.high))
      const lowest = Math.min(...slice.map(c => c.low))
      const currentClose = candles[i].close
      
      if (highest === lowest) {
        kValues.push(50)
      } else {
        const k = ((currentClose - lowest) / (highest - lowest)) * 100
        kValues.push(k)
      }
    }
  }
  
  const dValues = sma(kValues.filter(v => !isNaN(v)), dPeriod)
  const d: number[] = []
  
  for (let i = 0; i < kValues.length; i++) {
    if (isNaN(kValues[i])) {
      d.push(NaN)
    } else {
      const dIdx = i - (kValues.length - dValues.length)
      if (dIdx >= 0 && dIdx < dValues.length) {
        d.push(dValues[dIdx])
      } else {
        d.push(NaN)
      }
    }
  }
  
  return { k: kValues, d }
}

