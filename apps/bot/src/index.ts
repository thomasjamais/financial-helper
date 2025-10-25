import { createRedis, xadd } from '@pkg/event-bus'
const redis = createRedis()

async function main() {
  console.log('Bot online. Redis ok.')
  // Example: emit a heartbeat
  await xadd(redis, { stream: 'bot.heartbeat', values: { ts: new Date().toISOString() } })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
