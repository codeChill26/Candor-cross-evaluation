import { describe, it, expect } from 'vitest'
import { getEffectiveStatus } from '@/lib/utils/round-status'

describe('getEffectiveStatus', () => {
  const future = new Date(Date.now() + 60_000).toISOString()
  const past = new Date(Date.now() - 60_000).toISOString()

  it('returns "open" for an open round with a future deadline', () => {
    expect(getEffectiveStatus('open', future)).toBe('open')
  })

  it('returns "closed" for an open round whose deadline has passed', () => {
    expect(getEffectiveStatus('open', past)).toBe('closed')
  })

  it('returns "closed" for a round manually closed before its deadline', () => {
    expect(getEffectiveStatus('closed', future)).toBe('closed')
  })

  it('returns "draft" for a draft round regardless of deadline', () => {
    expect(getEffectiveStatus('draft', past)).toBe('draft')
  })
})
