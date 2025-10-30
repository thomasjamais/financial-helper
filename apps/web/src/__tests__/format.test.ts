import { describe, it, expect } from 'vitest'
import { formatNumber } from '../lib/format'

describe('formatNumber', () => {
  it('formats with default locale', () => {
    const out = formatNumber(1234.56, { minimumFractionDigits: 2, maximumFractionDigits: 2 }, 'en-US')
    expect(out).toBe('1,234.56')
  })

  it('formats with fr-FR locale', () => {
    const out = formatNumber(1234.56, { minimumFractionDigits: 2, maximumFractionDigits: 2 }, 'fr-FR')
    expect(out).toBe('1 234,56')
  })
})


