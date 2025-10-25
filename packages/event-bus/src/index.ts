import Redis from 'ioredis'

export type StreamMessage = { stream: string; id?: string; values: Record<string,string> }

export function createRedis(url?: string) {
  return new Redis(url ?? process.env.REDIS_URL ?? 'redis://localhost:6379')
}

export async function xadd(redis: Redis, msg: StreamMessage) {
  const flat: string[] = []
  for (const [k,v] of Object.entries(msg.values)) flat.push(k, v)
  return redis.xadd(msg.stream, msg.id ?? '*', ...flat)
}

export function consumerGroupName(service: string) {
  return `${service}-group`
}
