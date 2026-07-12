import { nanoid } from 'nanoid'

export const INVITE_EXPIRY_DAYS = 7

export function generateInviteToken(): string {
  return nanoid(32)
}

export function isInviteExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now()
}

export function inviteExpiryTimestamp(): string {
  return new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString()
}
