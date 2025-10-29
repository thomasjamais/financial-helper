import { Kysely, sql } from 'kysely'
import { makeEncryptDecrypt } from './crypto'

function makeDecrypt(encKey: string) {
  const { decrypt } = makeEncryptDecrypt(encKey)
  return { decrypt }
}

export type ExchangeConfig = {
  id: number
  exchange: 'bitget' | 'binance'
  label: string
  env: 'paper' | 'live'
  baseUrl?: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export type ExchangeConfigWithSecrets = ExchangeConfig & {
  key: string
  secret: string
  passphrase?: string
}

export type CreateExchangeConfigInput = {
  exchange: 'bitget' | 'binance'
  label: string
  key: string
  secret: string
  passphrase?: string
  env: 'paper' | 'live'
  baseUrl?: string
}

export type UpdateExchangeConfigInput = Partial<
  Omit<CreateExchangeConfigInput, 'exchange'>
> & {
  isActive?: boolean
}

export async function listExchangeConfigs(
  db: Kysely<unknown>,
  encKey: string,
): Promise<ExchangeConfig[]> {
  const rows = await sql<{
    id: number
    exchange: string
    label: string
    env: string
    base_url: string | null
    is_active: boolean
    created_at: Date
    updated_at: Date
  }>`
    select id, exchange, label, env, base_url, is_active, created_at, updated_at
    from exchange_configs
    order by exchange, label
  `.execute(db)

  return rows.rows.map((row) => ({
    id: row.id,
    exchange: row.exchange as 'bitget' | 'binance',
    label: row.label,
    env: row.env as 'paper' | 'live',
    baseUrl: row.base_url || undefined,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

export async function getExchangeConfig(
  db: Kysely<unknown>,
  encKey: string,
  id: number,
): Promise<ExchangeConfigWithSecrets | null> {
  const row = await sql<{
    id: number
    exchange: string
    label: string
    key_enc: string
    secret_enc: string
    passphrase_enc: string | null
    env: string
    base_url: string | null
    is_active: boolean
    created_at: Date
    updated_at: Date
  }>`
    select *
    from exchange_configs
    where id = ${id}
  `.execute(db)

  if (row.rows.length === 0) {
    return null
  }

  const data = row.rows[0]
  const { decrypt } = makeDecrypt(encKey)

  return {
    id: data.id,
    exchange: data.exchange as 'bitget' | 'binance',
    label: data.label,
    key: decrypt(data.key_enc),
    secret: decrypt(data.secret_enc),
    passphrase: data.passphrase_enc ? decrypt(data.passphrase_enc) : undefined,
    env: data.env as 'paper' | 'live',
    baseUrl: data.base_url || undefined,
    isActive: data.is_active,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

export async function createExchangeConfig(
  db: Kysely<unknown>,
  encKey: string,
  input: CreateExchangeConfigInput,
): Promise<ExchangeConfig> {
  const { encrypt } = makeEncryptDecrypt(encKey)

  const row = await sql<{
    id: number
    exchange: string
    label: string
    env: string
    base_url: string | null
    is_active: boolean
    created_at: Date
    updated_at: Date
  }>`
    insert into exchange_configs(exchange, label, key_enc, secret_enc, passphrase_enc, env, base_url)
    values (
      ${input.exchange},
      ${input.label},
      ${encrypt(input.key)},
      ${encrypt(input.secret)},
      ${input.passphrase ? encrypt(input.passphrase) : null},
      ${input.env},
      ${input.baseUrl || null}
    )
    returning id, exchange, label, env, base_url, is_active, created_at, updated_at
  `.execute(db)

  const data = row.rows[0]
  return {
    id: data.id,
    exchange: data.exchange as 'bitget' | 'binance',
    label: data.label,
    env: data.env as 'paper' | 'live',
    baseUrl: data.base_url || undefined,
    isActive: data.is_active,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

export async function updateExchangeConfig(
  db: Kysely<unknown>,
  encKey: string,
  id: number,
  input: UpdateExchangeConfigInput,
): Promise<ExchangeConfig | null> {
  const { encrypt } = makeEncryptDecrypt(encKey)

  if (
    input.label === undefined &&
    input.key === undefined &&
    input.secret === undefined &&
    input.passphrase === undefined &&
    input.env === undefined &&
    input.baseUrl === undefined &&
    input.isActive === undefined
  ) {
    const result = await sql<{
      id: number
      exchange: string
      label: string
      env: string
      base_url: string | null
      is_active: boolean
      created_at: Date
      updated_at: Date
    }>`
      select id, exchange, label, env, base_url, is_active, created_at, updated_at
      from exchange_configs
      where id = ${id}
    `.execute(db)

    if (result.rows.length === 0) return null

    const data = result.rows[0]
    return {
      id: data.id,
      exchange: data.exchange as 'bitget' | 'binance',
      label: data.label,
      env: data.env as 'paper' | 'live',
      baseUrl: data.base_url || undefined,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  }

  // Get current config first
  const current = await sql<{
    label: string
    key_enc: string
    secret_enc: string
    passphrase_enc: string | null
    env: string
    base_url: string | null
    is_active: boolean
  }>`
    select label, key_enc, secret_enc, passphrase_enc, env, base_url, is_active
    from exchange_configs
    where id = ${id}
  `.execute(db)

  if (current.rows.length === 0) {
    return null
  }

  const currentData = current.rows[0]
  const finalLabel = input.label !== undefined ? input.label : currentData.label
  const finalKeyEnc =
    input.key !== undefined ? encrypt(input.key) : currentData.key_enc
  const finalSecretEnc =
    input.secret !== undefined ? encrypt(input.secret) : currentData.secret_enc
  const finalPassphraseEnc =
    input.passphrase !== undefined
      ? input.passphrase
        ? encrypt(input.passphrase)
        : null
      : currentData.passphrase_enc
  const finalEnv = input.env !== undefined ? input.env : currentData.env
  const finalBaseUrl =
    input.baseUrl !== undefined ? input.baseUrl || null : currentData.base_url
  const finalIsActive =
    input.isActive !== undefined ? input.isActive : currentData.is_active

  const row = await sql<{
    id: number
    exchange: string
    label: string
    env: string
    base_url: string | null
    is_active: boolean
    created_at: Date
    updated_at: Date
  }>`
    update exchange_configs
    set
      label = ${finalLabel},
      key_enc = ${finalKeyEnc},
      secret_enc = ${finalSecretEnc},
      passphrase_enc = ${finalPassphraseEnc},
      env = ${finalEnv},
      base_url = ${finalBaseUrl},
      is_active = ${finalIsActive}
    where id = ${id}
    returning id, exchange, label, env, base_url, is_active, created_at, updated_at
  `.execute(db)

  if (row.rows.length === 0) {
    return null
  }

  const data = row.rows[0]
  return {
    id: data.id,
    exchange: data.exchange as 'bitget' | 'binance',
    label: data.label,
    env: data.env as 'paper' | 'live',
    baseUrl: data.base_url || undefined,
    isActive: data.is_active,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

export async function deleteExchangeConfig(
  db: Kysely<unknown>,
  id: number,
): Promise<boolean> {
  const result = await sql<{ id: number }>`
    delete from exchange_configs
    where id = ${id}
    returning id
  `.execute(db)

  return result.rows.length > 0
}

export async function activateExchangeConfig(
  db: Kysely<unknown>,
  encKey: string,
  id: number,
): Promise<ExchangeConfigWithSecrets | null> {
  const exchange = await sql<{ exchange: string }>`
    select exchange from exchange_configs where id = ${id}
  `.execute(db)

  if (exchange.rows.length === 0) {
    return null
  }

  await sql`
    update exchange_configs
    set is_active = false
    where exchange = ${exchange.rows[0].exchange}
  `.execute(db)

  await sql`
    update exchange_configs
    set is_active = true
    where id = ${id}
  `.execute(db)

  return getExchangeConfig(db, encKey, id)
}

export async function getActiveExchangeConfig(
  db: Kysely<unknown>,
  encKey: string,
  exchange: 'bitget' | 'binance',
): Promise<ExchangeConfigWithSecrets | null> {
  const row = await sql<{
    id: number
    exchange: string
    label: string
    key_enc: string
    secret_enc: string
    passphrase_enc: string | null
    env: string
    base_url: string | null
    is_active: boolean
    created_at: Date
    updated_at: Date
  }>`
    select *
    from exchange_configs
    where exchange = ${exchange} and is_active = true
    limit 1
  `.execute(db)

  if (row.rows.length === 0) {
    return null
  }

  const data = row.rows[0]
  const { decrypt } = makeDecrypt(encKey)

  return {
    id: data.id,
    exchange: data.exchange as 'bitget' | 'binance',
    label: data.label,
    key: decrypt(data.key_enc),
    secret: decrypt(data.secret_enc),
    passphrase: data.passphrase_enc ? decrypt(data.passphrase_enc) : undefined,
    env: data.env as 'paper' | 'live',
    baseUrl: data.base_url || undefined,
    isActive: data.is_active,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}
