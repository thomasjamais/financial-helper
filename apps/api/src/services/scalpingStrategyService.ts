import { sql } from 'kysely'
import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import type { Logger } from '../logger'

export interface ScalpingStrategy {
  id: number
  userId: string
  exchange: 'bitget' | 'binance'
  symbol: string
  maxCapital: number
  leverage: number
  riskPerTrade: number
  minConfidence: number
  maxOpenPositions: number
  isActive: boolean
  feeRate: number
  slippageBps: number
  createdAt: Date
  updatedAt: Date
}

export interface CreateScalpingStrategyInput {
  exchange: 'bitget' | 'binance'
  symbol: string
  maxCapital: number
  leverage: number
  riskPerTrade: number
  minConfidence: number
  maxOpenPositions: number
  feeRate?: number
  slippageBps?: number
}

export interface UpdateScalpingStrategyInput {
  maxCapital?: number
  leverage?: number
  riskPerTrade?: number
  minConfidence?: number
  maxOpenPositions?: number
  isActive?: boolean
  feeRate?: number
  slippageBps?: number
}

export class ScalpingStrategyService {
  constructor(
    private db: Kysely<DB>,
    private logger: Logger,
  ) {}

  async list(userId: string): Promise<ScalpingStrategy[]> {
    const rows = await sql<{
      id: number
      user_id: string
      exchange: string
      symbol: string
      max_capital: number
      leverage: number
      risk_per_trade: number
      min_confidence: number
      max_open_positions: number
      is_active: boolean
      fee_rate: number
      slippage_bps: number
      created_at: Date
      updated_at: Date
    }>`
      select *
      from scalping_strategies
      where user_id = ${userId}
      order by created_at desc
    `.execute(this.db)

    return rows.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      exchange: row.exchange as 'bitget' | 'binance',
      symbol: row.symbol,
      maxCapital: Number(row.max_capital),
      leverage: row.leverage,
      riskPerTrade: Number(row.risk_per_trade),
      minConfidence: Number(row.min_confidence),
      maxOpenPositions: row.max_open_positions,
      isActive: row.is_active,
      feeRate: Number(row.fee_rate),
      slippageBps: row.slippage_bps,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  }

  async getById(userId: string, id: number): Promise<ScalpingStrategy | null> {
    const rows = await sql<{
      id: number
      user_id: string
      exchange: string
      symbol: string
      max_capital: number
      leverage: number
      risk_per_trade: number
      min_confidence: number
      max_open_positions: number
      is_active: boolean
      fee_rate: number
      slippage_bps: number
      created_at: Date
      updated_at: Date
    }>`
      select *
      from scalping_strategies
      where id = ${id} and user_id = ${userId}
    `.execute(this.db)

    if (rows.rows.length === 0) {
      return null
    }

    const row = rows.rows[0]
    return {
      id: row.id,
      userId: row.user_id,
      exchange: row.exchange as 'bitget' | 'binance',
      symbol: row.symbol,
      maxCapital: Number(row.max_capital),
      leverage: row.leverage,
      riskPerTrade: Number(row.risk_per_trade),
      minConfidence: Number(row.min_confidence),
      maxOpenPositions: row.max_open_positions,
      isActive: row.is_active,
      feeRate: Number(row.fee_rate),
      slippageBps: row.slippage_bps,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  async getActiveStrategies(): Promise<ScalpingStrategy[]> {
    const rows = await sql<{
      id: number
      user_id: string
      exchange: string
      symbol: string
      max_capital: number
      leverage: number
      risk_per_trade: number
      min_confidence: number
      max_open_positions: number
      is_active: boolean
      fee_rate: number
      slippage_bps: number
      created_at: Date
      updated_at: Date
    }>`
      select *
      from scalping_strategies
      where is_active = true
      order by created_at desc
    `.execute(this.db)

    return rows.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      exchange: row.exchange as 'bitget' | 'binance',
      symbol: row.symbol,
      maxCapital: Number(row.max_capital),
      leverage: row.leverage,
      riskPerTrade: Number(row.risk_per_trade),
      minConfidence: Number(row.min_confidence),
      maxOpenPositions: row.max_open_positions,
      isActive: row.is_active,
      feeRate: Number(row.fee_rate),
      slippageBps: row.slippage_bps,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  }

  async create(
    userId: string,
    input: CreateScalpingStrategyInput,
  ): Promise<ScalpingStrategy> {
    const rows = await sql<{
      id: number
      user_id: string
      exchange: string
      symbol: string
      max_capital: number
      leverage: number
      risk_per_trade: number
      min_confidence: number
      max_open_positions: number
      is_active: boolean
      fee_rate: number
      slippage_bps: number
      created_at: Date
      updated_at: Date
    }>`
      insert into scalping_strategies(
        user_id, exchange, symbol, max_capital, leverage, risk_per_trade,
        min_confidence, max_open_positions, fee_rate, slippage_bps
      )
      values (
        ${userId},
        ${input.exchange},
        ${input.symbol},
        ${input.maxCapital},
        ${input.leverage},
        ${input.riskPerTrade},
        ${input.minConfidence},
        ${input.maxOpenPositions},
        ${input.feeRate ?? 0.001},
        ${input.slippageBps ?? 5}
      )
      returning *
    `.execute(this.db)

    const row = rows.rows[0]
    return {
      id: row.id,
      userId: row.user_id,
      exchange: row.exchange as 'bitget' | 'binance',
      symbol: row.symbol,
      maxCapital: Number(row.max_capital),
      leverage: row.leverage,
      riskPerTrade: Number(row.risk_per_trade),
      minConfidence: Number(row.min_confidence),
      maxOpenPositions: row.max_open_positions,
      isActive: row.is_active,
      feeRate: Number(row.fee_rate),
      slippageBps: row.slippage_bps,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  async update(
    userId: string,
    id: number,
    input: UpdateScalpingStrategyInput,
  ): Promise<ScalpingStrategy | null> {
    const updates: string[] = []
    const values: Record<string, unknown> = { id, userId }

    if (input.maxCapital !== undefined) {
      updates.push('max_capital = ${maxCapital}')
      values.maxCapital = input.maxCapital
    }
    if (input.leverage !== undefined) {
      updates.push('leverage = ${leverage}')
      values.leverage = input.leverage
    }
    if (input.riskPerTrade !== undefined) {
      updates.push('risk_per_trade = ${riskPerTrade}')
      values.riskPerTrade = input.riskPerTrade
    }
    if (input.minConfidence !== undefined) {
      updates.push('min_confidence = ${minConfidence}')
      values.minConfidence = input.minConfidence
    }
    if (input.maxOpenPositions !== undefined) {
      updates.push('max_open_positions = ${maxOpenPositions}')
      values.maxOpenPositions = input.maxOpenPositions
    }
    if (input.isActive !== undefined) {
      updates.push('is_active = ${isActive}')
      values.isActive = input.isActive
    }
    if (input.feeRate !== undefined) {
      updates.push('fee_rate = ${feeRate}')
      values.feeRate = input.feeRate
    }
    if (input.slippageBps !== undefined) {
      updates.push('slippage_bps = ${slippageBps}')
      values.slippageBps = input.slippageBps
    }

    if (updates.length === 0) {
      return this.getById(userId, id)
    }

    const updateClause = updates.join(', ')
    const rows = await sql<{
      id: number
      user_id: string
      exchange: string
      symbol: string
      max_capital: number
      leverage: number
      risk_per_trade: number
      min_confidence: number
      max_open_positions: number
      is_active: boolean
      fee_rate: number
      slippage_bps: number
      created_at: Date
      updated_at: Date
    }>`
      update scalping_strategies
      set ${sql.raw(updateClause)}
      where id = ${id} and user_id = ${userId}
      returning *
    `.execute(this.db)

    if (rows.rows.length === 0) {
      return null
    }

    const row = rows.rows[0]
    return {
      id: row.id,
      userId: row.user_id,
      exchange: row.exchange as 'bitget' | 'binance',
      symbol: row.symbol,
      maxCapital: Number(row.max_capital),
      leverage: row.leverage,
      riskPerTrade: Number(row.risk_per_trade),
      minConfidence: Number(row.min_confidence),
      maxOpenPositions: row.max_open_positions,
      isActive: row.is_active,
      feeRate: Number(row.fee_rate),
      slippageBps: row.slippage_bps,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  async delete(userId: string, id: number): Promise<boolean> {
    const result = await sql`
      delete from scalping_strategies
      where id = ${id} and user_id = ${userId}
    `.execute(this.db)

    return (result.numUpdatedRows || 0) > 0
  }
}
