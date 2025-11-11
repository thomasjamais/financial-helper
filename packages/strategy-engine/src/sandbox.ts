import { VM } from 'vm2'
import type { Candle, Strategy, StrategySignal } from './types'
import { createStrategyAPI } from './api'
import { validateStrategyCode } from './validators'

export type SandboxOptions = {
  timeout?: number
  memoryLimit?: number
}

export type StrategyExecutionResult = {
  success: boolean
  signal?: StrategySignal
  error?: string
}

export class StrategySandbox {
  private vm: VM
  private strategyInstance: Strategy | null = null

  constructor(
    private code: string,
    private options: SandboxOptions = {},
  ) {
    const validation = validateStrategyCode(code)
    if (!validation.valid) {
      throw new Error(`Invalid strategy code: ${validation.error}`)
    }

    const api = createStrategyAPI()
    const timeout = options.timeout ?? 30000

    this.vm = new VM({
      timeout,
      sandbox: {
        indicators: api.indicators,
        Math: api.Math,
        Array: api.Array,
        Number: api.Number,
        String: api.String,
        Date: api.Date,
        JSON: api.JSON,
        console: {
          log: () => {},
          error: () => {},
          warn: () => {},
        },
      },
      eval: false,
      wasm: false,
      fixAsync: true,
    })
  }

  initialize(candles: Candle[]): void {
    try {
      const wrappedCode = `
        ${this.code}
        
        if (typeof Strategy === 'undefined' && typeof strategy === 'undefined') {
          throw new Error('Strategy class not found. Expected class named "Strategy" or variable "strategy"');
        }
        
        const StrategyClass = typeof Strategy !== 'undefined' ? Strategy : strategy;
        const instance = new StrategyClass();
        
        if (typeof instance.initialize !== 'function') {
          throw new Error('Strategy must implement initialize method');
        }
        
        if (typeof instance.onCandle !== 'function') {
          throw new Error('Strategy must implement onCandle method');
        }
        
        instance.initialize(__candles__);
        instance;
      `

      this.vm.sandbox.__candles__ = JSON.parse(JSON.stringify(candles))

      const result = this.vm.run(wrappedCode)

      if (!result || typeof result.onCandle !== 'function') {
        throw new Error('Strategy instance is invalid')
      }

      this.strategyInstance = result as Strategy
    } catch (error) {
      throw new Error(
        `Failed to initialize strategy: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  execute(
    candle: Candle,
    index: number,
    candles: Candle[],
  ): StrategyExecutionResult {
    if (!this.strategyInstance) {
      return {
        success: false,
        error: 'Strategy not initialized. Call initialize() first.',
      }
    }

    try {
      const signal = this.strategyInstance.onCandle(
        JSON.parse(JSON.stringify(candle)),
        index,
        JSON.parse(JSON.stringify(candles)),
      )

      if (signal !== 'buy' && signal !== 'sell' && signal !== 'hold') {
        return {
          success: false,
          error: `Invalid signal returned: ${signal}. Expected 'buy', 'sell', or 'hold'`,
        }
      }

      return {
        success: true,
        signal,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  static createStrategy(
    code: string,
    options?: SandboxOptions,
  ): StrategySandbox {
    return new StrategySandbox(code, options)
  }
}
