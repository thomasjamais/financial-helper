import { z } from 'zod'

export const BitgetConfigSchema = z
  .object({
    key: z.string().min(10),
    secret: z.string().min(10),
    passphrase: z.string().min(1),
    env: z.enum(['paper', 'live']).default('paper'),
    baseUrl: z.string().url().optional(),
  })
  .transform((data) => {
    if (data.baseUrl) {
      return { ...data, baseUrl: data.baseUrl }
    }
    if (data.env === 'paper') {
      return { ...data, baseUrl: 'https://api.bitget.com' }
    }
    return { ...data, baseUrl: 'https://api.bitget.com' }
  })

export type BitgetConfig = z.infer<typeof BitgetConfigSchema>

export const BinanceConfigSchema = z
  .object({
    key: z.string().min(10),
    secret: z.string().min(10),
    env: z.enum(['paper', 'live']).default('paper'),
    baseUrl: z.string().url().optional(),
  })
  .transform((data) => {
    if (data.baseUrl) {
      return { ...data, baseUrl: data.baseUrl }
    }
    if (data.env === 'paper') {
      return { ...data, baseUrl: 'https://testnet.binance.vision' }
    }
    return { ...data, baseUrl: 'https://api.binance.com' }
  })

export type BinanceConfig = z.infer<typeof BinanceConfigSchema>
