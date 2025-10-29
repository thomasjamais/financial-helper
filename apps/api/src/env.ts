import { z } from 'zod'

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  API_ENC_KEY: z.string().min(16),
  PORT: z.string().optional(),
  LOG_LEVEL: z.string().optional(),
})

export type Env = z.infer<typeof EnvSchema>

export function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env)
  if (!parsed.success) {
    throw new Error(parsed.error.message)
  }
  return parsed.data
}
