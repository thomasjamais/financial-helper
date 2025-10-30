import { BinanceHttpClient } from '../http/binanceHttpClient'
import type { Balance } from '../types'

export type EarnProduct = {
  id: string
  asset: string
  name: string
  type: 'flexible' | 'locked'
  apr: number
  durationDays?: number
  redeemable: boolean
}

export class BinanceEarnClient {
  constructor(private readonly http: BinanceHttpClient) {}

  async getEarnBalances(): Promise<Balance[]> {
    const results: Balance[] = []
    try {
      const flex = await this.http.call<any>(
        'GET',
        '/sapi/v1/simple-earn/flexible/position',
      )
      const flexItems: any[] = Array.isArray(flex?.rows) ? flex.rows : []
      for (const it of flexItems) {
        const asset = it.asset || it.rewardAsset
        const amount = parseFloat(it.totalAmount || it.amount || '0')
        if (!asset || !amount) continue
        results.push({ asset, free: amount })
      }
    } catch {}

    try {
      const locked = await this.http.call<any>(
        'GET',
        '/sapi/v1/simple-earn/locked/position',
      )
      const lockedItems: any[] = Array.isArray(locked?.rows) ? locked.rows : []
      for (const it of lockedItems) {
        const asset = it.asset || it.rewardAsset
        const amount = parseFloat(it.totalAmount || it.amount || '0')
        if (!asset || !amount) continue
        results.push({ asset, free: amount })
      }
    } catch {}

    return results
  }

  async listProducts(): Promise<EarnProduct[]> {
    const products: EarnProduct[] = []
    try {
      const flex = await this.http.call<any>(
        'GET',
        '/sapi/v1/simple-earn/flexible/list',
      )
      const items: any[] = Array.isArray(flex?.rows) ? flex.rows : []
      for (const it of items) {
        const apr = parseFloat(it.latestAnnualPercentageRate || it.apr || '0')
        products.push({
          id: String(it.productId ?? it.projectId ?? `${it.asset}-flex`),
          asset: it.asset,
          name: it.projectName || `${it.asset} Flexible`,
          type: 'flexible',
          apr: isFinite(apr) ? apr : 0,
          redeemable: true,
        })
      }
    } catch {}

    try {
      const locked = await this.http.call<any>(
        'GET',
        '/sapi/v1/simple-earn/locked/list',
      )
      const items: any[] = Array.isArray(locked?.rows) ? locked.rows : []
      for (const it of items) {
        const apr = parseFloat(it.latestAnnualPercentageRate || it.apr || '0')
        const duration = Number(it.period || it.duration || it.lockedDays || 0)
        products.push({
          id: String(
            it.productId ?? it.projectId ?? `${it.asset}-locked-${duration}`,
          ),
          asset: it.asset,
          name: it.projectName || `${it.asset} Locked ${duration}d`,
          type: 'locked',
          apr: isFinite(apr) ? apr : 0,
          durationDays: isFinite(duration) ? duration : undefined,
          redeemable: false,
        })
      }
    } catch {}

    return products
  }

  async subscribeFlexible(params: { asset: string; amount: number }): Promise<{ success: boolean }> {
    await this.http.call(
      'POST',
      '/sapi/v1/simple-earn/flexible/subscribe',
      { asset: params.asset, amount: params.amount },
    )
    return { success: true }
  }

  async redeemFlexible(params: { asset: string; amount: number }): Promise<{ success: boolean }> {
    await this.http.call(
      'POST',
      '/sapi/v1/simple-earn/flexible/redeem',
      { asset: params.asset, amount: params.amount },
    )
    return { success: true }
  }
}
