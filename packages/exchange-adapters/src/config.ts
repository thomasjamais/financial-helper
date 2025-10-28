import { z } from 'zod'

export const BitgetConfigSchema = z.object({
  key: z.string().min(10),
  secret: z.string().min(10),
  passphrase: z.string().min(1),
  env: z.enum(['paper', 'live']).default('paper'),
  baseUrl: z.string().url().default('https://api.bitget.com'),
})

export type BitgetConfig = z.infer<typeof BitgetConfigSchema>
