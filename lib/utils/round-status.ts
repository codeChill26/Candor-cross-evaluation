export type RoundStatus = 'draft' | 'collecting' | 'open' | 'closed'

export function getEffectiveStatus(status: RoundStatus, deadline: string): RoundStatus {
  if (status === 'open' && new Date(deadline).getTime() < Date.now()) {
    return 'closed'
  }
  return status
}
