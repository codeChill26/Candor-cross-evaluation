import { describe, it, expect } from 'vitest'
import { registerSchema, loginSchema } from '@/lib/validations/auth'
import { createTeamSchema, inviteMemberSchema } from '@/lib/validations/team'

describe('registerSchema', () => {
  it('accepts a valid registration payload', () => {
    const result = registerSchema.safeParse({
      fullName: 'Nguyễn Văn A',
      email: 'a@example.com',
      password: 'password123',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a password shorter than 8 characters', () => {
    const result = registerSchema.safeParse({
      fullName: 'Nguyễn Văn A',
      email: 'a@example.com',
      password: 'short1',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid email', () => {
    const result = registerSchema.safeParse({
      fullName: 'Nguyễn Văn A',
      email: 'not-an-email',
      password: 'password123',
    })
    expect(result.success).toBe(false)
  })
})

describe('loginSchema', () => {
  it('accepts email + non-empty password', () => {
    expect(loginSchema.safeParse({ email: 'a@example.com', password: 'x' }).success).toBe(true)
  })

  it('rejects an empty password', () => {
    expect(loginSchema.safeParse({ email: 'a@example.com', password: '' }).success).toBe(false)
  })
})

describe('createTeamSchema', () => {
  it('accepts a 2-50 char team name', () => {
    expect(createTeamSchema.safeParse({ name: 'Team Alpha' }).success).toBe(true)
  })

  it('rejects a 1-char team name', () => {
    expect(createTeamSchema.safeParse({ name: 'A' }).success).toBe(false)
  })

  it('rejects a name over 50 chars', () => {
    expect(createTeamSchema.safeParse({ name: 'A'.repeat(51) }).success).toBe(false)
  })
})

describe('inviteMemberSchema', () => {
  it('accepts an empty email (open link invite)', () => {
    expect(inviteMemberSchema.safeParse({ email: undefined }).success).toBe(true)
  })

  it('accepts a valid email (direct invite)', () => {
    expect(inviteMemberSchema.safeParse({ email: 'b@example.com' }).success).toBe(true)
  })

  it('rejects a malformed email', () => {
    expect(inviteMemberSchema.safeParse({ email: 'not-an-email' }).success).toBe(false)
  })
})
