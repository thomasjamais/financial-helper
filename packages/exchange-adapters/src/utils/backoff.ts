export async function withBackoff<T>(
  fn: () => Promise<T>,
  attempts = 5,
  baseMs = 200,
) {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      const jitter = Math.floor(Math.random() * baseMs)
      const delay = Math.min(5000, baseMs * 2 ** i) + jitter
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw lastErr
}
