import { describe, it, expect } from 'vitest'
import { buildInviteEmailSubject, buildInviteEmailHtml } from '@/lib/email/invite-email'

const input = { teamName: 'Marketing', inviterName: 'An', joinUrl: 'https://x.test/join/abc123' }

describe('buildInviteEmailSubject', () => {
  it('includes the team name', () => {
    expect(buildInviteEmailSubject(input)).toBe('Bạn được mời tham gia team Marketing trên Candor')
  })
})

describe('buildInviteEmailHtml', () => {
  it('includes the join link', () => {
    expect(buildInviteEmailHtml(input)).toContain('https://x.test/join/abc123')
  })

  it('includes the inviter name and team name', () => {
    const html = buildInviteEmailHtml(input)
    expect(html).toContain('An')
    expect(html).toContain('Marketing')
  })

  it('escapes HTML special characters instead of injecting them raw', () => {
    const html = buildInviteEmailHtml({ ...input, teamName: '<b>Evil</b>' })
    expect(html).not.toContain('<b>Evil</b>')
    expect(html).toContain('&lt;b&gt;Evil&lt;/b&gt;')
  })
})
