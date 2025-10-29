type Balance = { asset: string; free: number; locked?: number }

const SPOT_ASSETS = new Set(['USDT', 'BTC', 'BNB', 'ETH'])
const FUTURES_ASSETS = new Set(['USDT'])

export function filterBalances(
  spot: Balance[],
  futures: Balance[],
): {
  spot: Balance[]
  futures: Balance[]
} {
  const spotFiltered = spot.filter(
    (b) => SPOT_ASSETS.has(b.asset.toUpperCase()) && b.free > 0,
  )

  const futuresFiltered = futures.filter(
    (b) => FUTURES_ASSETS.has(b.asset.toUpperCase()) && b.free > 0,
  )

  return {
    spot: spotFiltered.sort((a, b) => {
      const order = ['USDT', 'BTC', 'ETH', 'BNB']
      const idxA = order.indexOf(a.asset.toUpperCase())
      const idxB = order.indexOf(b.asset.toUpperCase())
      if (idxA === -1 && idxB === -1) return a.asset.localeCompare(b.asset)
      if (idxA === -1) return 1
      if (idxB === -1) return -1
      return idxA - idxB
    }),
    futures: futuresFiltered,
  }
}
