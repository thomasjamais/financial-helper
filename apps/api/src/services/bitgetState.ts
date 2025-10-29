import { type BitgetConfig } from '@pkg/exchange-adapters'

let cfg: BitgetConfig | undefined

export function setBitgetConfig(newCfg: BitgetConfig): void {
  cfg = newCfg
}

export function getBitgetConfig(): BitgetConfig | undefined {
  return cfg
}
