export class RateLimiter {
  private tokens: number
  private lastRefill: number
  constructor(
    private capacity: number,
    private refillPerSec: number,
  ) {
    this.tokens = capacity
    this.lastRefill = Date.now()
  }
  async take(cost = 1) {
    while (true) {
      this.refill()
      if (this.tokens >= cost) {
        this.tokens -= cost
        return
      }
      await new Promise((r) => setTimeout(r, 100))
    }
  }
  private refill() {
    const now = Date.now()
    const delta = (now - this.lastRefill) / 1000
    if (delta > 0) {
      this.tokens = Math.min(
        this.capacity,
        this.tokens + delta * this.refillPerSec,
      )
      this.lastRefill = now
    }
  }
}
