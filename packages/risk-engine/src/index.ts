export interface RiskConfig {
  maxLeverage: number
  maxRiskPerTrade: number // as percentage (e.g., 0.02 = 2%)
  maxPositionSize: number // as percentage of balance
  minOrderSize: number
  maxOrderSize: number
}

export interface Balance {
  asset: string
  free: number
}

export interface OrderSizingParams {
  balance: number
  price: number
  riskConfig: RiskConfig
  leverage?: number
  stopLossPercent?: number
}

export interface PositionSizingResult {
  maxQuantity: number
  maxNotional: number
  recommendedQuantity: number
  recommendedNotional: number
  leverageUsed: number
  riskAmount: number
}

/**
 * Calculate maximum position size based on balance and risk parameters
 */
export function calculateMaxPositionSize(params: OrderSizingParams): PositionSizingResult {
  const { balance, price, riskConfig, leverage = 1, stopLossPercent = 0.02 } = params
  
  // Calculate maximum notional based on balance and max position size
  const maxNotionalFromBalance = balance * riskConfig.maxPositionSize
  
  // Calculate maximum notional based on leverage
  const maxNotionalFromLeverage = balance * leverage
  
  // Use the smaller of the two
  const maxNotional = Math.min(maxNotionalFromBalance, maxNotionalFromLeverage)
  
  // Calculate maximum quantity
  const maxQuantity = maxNotional / price
  
  // Calculate risk amount (stop loss)
  const riskAmount = maxNotional * stopLossPercent
  
  // Calculate recommended position size based on risk per trade
  const maxRiskAmount = balance * riskConfig.maxRiskPerTrade
  const riskRatio = Math.min(1, maxRiskAmount / riskAmount)
  
  const recommendedNotional = maxNotional * riskRatio
  const recommendedQuantity = recommendedNotional / price
  
  // Ensure quantities are within min/max order size
  const finalQuantity = Math.max(
    riskConfig.minOrderSize,
    Math.min(riskConfig.maxOrderSize, recommendedQuantity)
  )
  
  const finalNotional = finalQuantity * price
  
  return {
    maxQuantity,
    maxNotional,
    recommendedQuantity: finalQuantity,
    recommendedNotional: finalNotional,
    leverageUsed: leverage,
    riskAmount: finalNotional * stopLossPercent,
  }
}

/**
 * Validate leverage against maximum allowed
 */
export function validateLeverage(leverage: number, riskConfig: RiskConfig): boolean {
  return leverage <= riskConfig.maxLeverage && leverage > 0
}

/**
 * Calculate position size for spot trading (no leverage)
 */
export function calculateSpotPositionSize(
  balance: number,
  price: number,
  riskConfig: RiskConfig,
  stopLossPercent = 0.02
): PositionSizingResult {
  return calculateMaxPositionSize({
    balance,
    price,
    riskConfig,
    leverage: 1,
    stopLossPercent,
  })
}

/**
 * Calculate position size for futures trading (with leverage)
 */
export function calculateFuturesPositionSize(
  balance: number,
  price: number,
  riskConfig: RiskConfig,
  leverage: number,
  stopLossPercent = 0.02
): PositionSizingResult {
  if (!validateLeverage(leverage, riskConfig)) {
    throw new Error(`Leverage ${leverage} exceeds maximum ${riskConfig.maxLeverage}`)
  }
  
  return calculateMaxPositionSize({
    balance,
    price,
    riskConfig,
    leverage,
    stopLossPercent,
  })
}

/**
 * Get default risk configuration
 */
export function getDefaultRiskConfig(): RiskConfig {
  return {
    maxLeverage: 10,
    maxRiskPerTrade: 0.02, // 2%
    maxPositionSize: 0.1, // 10% of balance
    minOrderSize: 0.001,
    maxOrderSize: 1000,
  }
}

/**
 * Parse risk configuration from environment variables
 */
export function parseRiskConfigFromEnv(env = process.env): RiskConfig {
  return {
    maxLeverage: Number(env.MAX_LEVERAGE ?? '10'),
    maxRiskPerTrade: Number(env.MAX_RISK_PER_TRADE ?? '0.02'),
    maxPositionSize: Number(env.MAX_POSITION_SIZE ?? '0.1'),
    minOrderSize: Number(env.MIN_ORDER_SIZE ?? '0.001'),
    maxOrderSize: Number(env.MAX_ORDER_SIZE ?? '1000'),
  }
}
