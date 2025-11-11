import type { Candle, StrategySignal } from './types'
import * as indicators from './indicators'

export type StrategyAPI = {
  indicators: {
    sma: (values: number[], period: number) => number[]
    ema: (values: number[], period: number) => number[]
    rsi: (values: number[], period?: number) => number[]
    macd: (
      values: number[],
      fastPeriod?: number,
      slowPeriod?: number,
      signalPeriod?: number,
    ) => { macd: number[]; signal: number[]; histogram: number[] }
    bollingerBands: (
      values: number[],
      period?: number,
      stdDev?: number,
    ) => { upper: number[]; middle: number[]; lower: number[] }
    atr: (candles: Candle[], period?: number) => number[]
    stochastic: (
      candles: Candle[],
      kPeriod?: number,
      dPeriod?: number,
    ) => { k: number[]; d: number[] }
  }
  Math: typeof Math
  Array: typeof Array
  Number: typeof Number
  String: typeof String
  Date: typeof Date
  JSON: typeof JSON
}

export function createStrategyAPI(): StrategyAPI {
  return {
    indicators: {
      sma: indicators.sma,
      ema: indicators.ema,
      rsi: indicators.rsi,
      macd: indicators.macd,
      bollingerBands: indicators.bollingerBands,
      atr: indicators.atr,
      stochastic: indicators.stochastic,
    },
    Math,
    Array,
    Number,
    String,
    Date,
    JSON,
  }
}

