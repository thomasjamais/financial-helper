import type { Strategy } from '@pkg/backtesting-engine'
import { SmaCrossoverStrategy } from './sma-crossover.js'

/**
 * Strategy registry for creating strategies by name
 */
export class StrategyRegistry {
  private static strategies: Map<string, () => Strategy> = new Map()

  static {
    // Register built-in strategies
    this.register('sma-crossover', () => new SmaCrossoverStrategy())
  }

  /**
   * Register a strategy factory function
   */
  static register(name: string, factory: () => Strategy): void {
    this.strategies.set(name, factory)
  }

  /**
   * Create a strategy instance by name
   */
  static create(name: string): Strategy {
    const factory = this.strategies.get(name)
    if (!factory) {
      throw new Error(`Strategy not found: ${name}`)
    }
    return factory()
  }

  /**
   * Get list of available strategy names
   */
  static list(): string[] {
    return Array.from(this.strategies.keys())
  }
}

