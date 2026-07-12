import { describe, it, expect } from 'vitest'
import { generateInviteToken, INVITE_EXPIRY_DAYS, isInviteExpired } from '@/lib/utils/invite-token'

describe('generateInviteToken', () => {
  it('generates a 32-character URL-safe token', () => {
    const token = generateInviteToken()
    expect(token).toHaveLength(32)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('generates unique tokens across calls', () => {
    expect(generateInviteToken()).not.toBe(generateInviteToken())
  })
})

describe('isInviteExpired', () => {
  it('returns true for a timestamp in the past', () => {
    expect(isInviteExpired(new Date(Date.now() - 1000).toISOString())).toBe(true)
  })

  it('returns false for a timestamp in the future', () => {
    expect(isInviteExpired(new Date(Date.now() + 1000).toISOString())).toBe(false)
  })

  it('exposes a 7-day expiry window', () => {
    expect(INVITE_EXPIRY_DAYS).toBe(7)
  })
})
