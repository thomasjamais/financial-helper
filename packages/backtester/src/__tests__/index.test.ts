import { describe, it, expect } from 'vitest'
import * as exported from '../index'

describe('index exports', () => {
  it('exports engine, types and strategies', () => {
    expect(exported).toHaveProperty('runBacktest')
    expect(exported).toHaveProperty('SmaCrossStrategy')
  })
})
