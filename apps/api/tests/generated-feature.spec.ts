import { describe, it, expect } from 'vitest'
import { GeneratedFeature } from '../src/generated-feature'

describe('GeneratedFeature', () => {
  it('should process successfully', () => {
    const feature = new GeneratedFeature()
    const result = feature.process()
    expect(result).toBe('Feature processed successfully')
  })
})