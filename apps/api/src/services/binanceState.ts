import { type BinanceConfig } from '@pkg/exchange-adapters'

let cfg: BinanceConfig | undefined

export function setBinanceConfig(newCfg: BinanceConfig): void {
  cfg = newCfg
}

export function getBinanceConfig(): BinanceConfig | undefined {
  return cfg
}
