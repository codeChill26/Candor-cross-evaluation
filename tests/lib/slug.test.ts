import { describe, it, expect } from 'vitest'
import { generateSlug } from '@/lib/utils/slug'

describe('generateSlug', () => {
  it('lowercases and hyphenates a simple name', () => {
    expect(generateSlug('Team Alpha')).toMatch(/^team-alpha-[a-z0-9]{6}$/)
  })

  it('strips Vietnamese diacritics', () => {
    expect(generateSlug('Đội Phượng Hoàng')).toMatch(/^doi-phuong-hoang-[a-z0-9]{6}$/)
  })

  it('collapses non-alphanumeric runs into single hyphens', () => {
    expect(generateSlug('  Team!!  Beta__2026  ')).toMatch(/^team-beta-2026-[a-z0-9]{6}$/)
  })

  it('produces different slugs for the same name on repeated calls', () => {
    expect(generateSlug('Team Alpha')).not.toBe(generateSlug('Team Alpha'))
  })
})
