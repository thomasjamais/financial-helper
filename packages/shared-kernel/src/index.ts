export type UUID = string

export type Money = {
  amount: number // in base currency units
  currency: string
}

export function assert(condition: any, msg: string): asserts condition {
  if (!condition) throw new Error(msg)
}

export function correlationId(): string {
  return `corr_${crypto.randomUUID()}`
}
