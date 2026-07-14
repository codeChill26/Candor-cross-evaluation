import { z } from 'zod'

export const MAX_EMAILS_PER_SUBMIT = 100

export function parseEmailList(raw: string): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const part of raw.split(/[,\n]/)) {
    const value = part.trim().toLowerCase()
    if (value && !seen.has(value)) {
      seen.add(value)
      result.push(value)
    }
  }
  return result
}

export function isValidEmail(value: string): boolean {
  return z.email().safeParse(value).success
}

export type EmailClassification = {
  alreadyMember: string[]
  alreadyInvited: string[]
  toInvite: string[]
}

export function classifyEmails(
  emails: string[],
  memberEmails: Set<string>,
  pendingInviteEmails: Set<string>
): EmailClassification {
  const alreadyMember: string[] = []
  const alreadyInvited: string[] = []
  const toInvite: string[] = []
  for (const email of emails) {
    if (memberEmails.has(email)) {
      alreadyMember.push(email)
    } else if (pendingInviteEmails.has(email)) {
      alreadyInvited.push(email)
    } else {
      toInvite.push(email)
    }
  }
  return { alreadyMember, alreadyInvited, toInvite }
}
