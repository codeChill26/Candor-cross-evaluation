import { describe, it, expect } from 'vitest'
import { parseEmailList, isValidEmail, classifyEmails } from '@/lib/utils/parse-email-list'

describe('parseEmailList', () => {
  it('splits on commas and newlines', () => {
    expect(parseEmailList('a@x.com, b@y.com\nc@z.com')).toEqual(['a@x.com', 'b@y.com', 'c@z.com'])
  })

  it('trims whitespace around each entry', () => {
    expect(parseEmailList('  a@x.com  ,  b@y.com  ')).toEqual(['a@x.com', 'b@y.com'])
  })

  it('drops empty entries from blank lines or trailing commas', () => {
    expect(parseEmailList('a@x.com,,\n\nb@y.com,')).toEqual(['a@x.com', 'b@y.com'])
  })

  it('dedupes case-insensitively, keeping the first occurrence', () => {
    expect(parseEmailList('A@x.com\na@X.com')).toEqual(['a@x.com'])
  })
})

describe('isValidEmail', () => {
  it('accepts a well-formed email', () => {
    expect(isValidEmail('a@x.com')).toBe(true)
  })

  it('rejects a malformed value', () => {
    expect(isValidEmail('not-an-email')).toBe(false)
  })
})

describe('classifyEmails', () => {
  it('separates already-member, already-invited, and eligible emails', () => {
    const result = classifyEmails(
      ['a@x.com', 'b@x.com', 'c@x.com'],
      new Set(['a@x.com']),
      new Set(['b@x.com'])
    )
    expect(result).toEqual({
      alreadyMember: ['a@x.com'],
      alreadyInvited: ['b@x.com'],
      toInvite: ['c@x.com'],
    })
  })

  it('treats already-member as taking priority over already-invited', () => {
    const result = classifyEmails(['a@x.com'], new Set(['a@x.com']), new Set(['a@x.com']))
    expect(result.alreadyMember).toEqual(['a@x.com'])
    expect(result.alreadyInvited).toEqual([])
  })

  it('returns empty buckets for an empty input list', () => {
    expect(classifyEmails([], new Set(), new Set())).toEqual({
      alreadyMember: [],
      alreadyInvited: [],
      toInvite: [],
    })
  })
})
