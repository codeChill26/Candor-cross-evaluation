'use server'

import { createClient } from '@/lib/supabase/server'
import { inviteMemberSchema } from '@/lib/validations/team'
import { generateInviteToken, inviteExpiryTimestamp } from '@/lib/utils/invite-token'
import { headers } from 'next/headers'
import { z } from 'zod'
import { isInviteExpired } from '@/lib/utils/invite-token'
import { MAX_EMAILS_PER_SUBMIT, classifyEmails } from '@/lib/utils/parse-email-list'
import { resend } from '@/lib/email/resend'
import { buildInviteEmailSubject, buildInviteEmailHtml } from '@/lib/email/invite-email'

type CreateInviteResult =
  | { error: string }
  | { data: { token: string; email: string | null } }

export async function createInvite(teamId: string, formData: FormData): Promise<CreateInviteResult> {
  const rawEmail = formData.get('email')
  const parsed = inviteMemberSchema.safeParse({
    email: rawEmail && rawEmail !== '' ? rawEmail : undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Không xác thực được người dùng' }
  }

  const token = generateInviteToken()

  const { data, error } = await supabase
    .from('team_invites')
    .insert({
      team_id: teamId,
      token,
      email: parsed.data.email ?? null,
      created_by: user.id,
      expires_at: inviteExpiryTimestamp(),
    })
    .select('token, email')
    .single()

  if (error) {
    return { error: error.message }
  }

  return { data }
}

export type BulkInviteSummary = {
  sent: string[]
  invalidFormat: string[]
  alreadyMember: string[]
  alreadyInvited: string[]
  emailDeliveryFailed: boolean
}

type CreateBulkInvitesResult = { error: string } | { data: BulkInviteSummary }

export async function createBulkInvites(
  teamId: string,
  teamName: string,
  emails: string[]
): Promise<CreateBulkInvitesResult> {
  if (emails.length > MAX_EMAILS_PER_SUBMIT) {
    return { error: `Tối đa ${MAX_EMAILS_PER_SUBMIT} email mỗi lượt gửi` }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Không xác thực được người dùng' }
  }

  // Normalize once, up front, so every downstream comparison (member lookup,
  // pending-invite lookup, insert) operates on the same trimmed/lowercased
  // form. This matches the convention in lib/utils/parse-email-list.ts.
  const normalizedEmails = emails.map((email) => email.trim().toLowerCase())

  const invalidFormat: string[] = []
  const validEmails: string[] = []
  for (const email of normalizedEmails) {
    if (z.email().safeParse(email).success) {
      validEmails.push(email)
    } else {
      invalidFormat.push(email)
    }
  }

  if (validEmails.length === 0) {
    return {
      data: { sent: [], invalidFormat, alreadyMember: [], alreadyInvited: [], emailDeliveryFailed: false },
    }
  }

  const { data: members, error: membersError } = await supabase
    .from('team_members')
    .select('profiles(email)')
    .eq('team_id', teamId)
  if (membersError) {
    return { error: membersError.message }
  }
  const memberEmails = new Set(
    ((members ?? []) as unknown as { profiles: { email: string } }[]).map((m) =>
      m.profiles.email.trim().toLowerCase()
    )
  )

  // Note: no `.in('email', validEmails)` filter here. team_invites.email is
  // plain text and prior invites (e.g. from the single-invite path, which is
  // not normalized) may be stored with arbitrary casing. Postgres `.in()` is
  // a case-sensitive equality check, so filtering by our now-lowercased
  // validEmails could silently miss a differently-cased existing row. Fetch
  // all of the team's invites instead and compare after normalizing, the
  // same way memberEmails is derived above.
  const { data: existingInvites, error: invitesError } = await supabase
    .from('team_invites')
    .select('email, expires_at, used_at')
    .eq('team_id', teamId)
  if (invitesError) {
    return { error: invitesError.message }
  }
  const pendingInviteEmails = new Set(
    (existingInvites ?? [])
      .filter((invite) => invite.email && !invite.used_at && !isInviteExpired(invite.expires_at))
      .map((invite) => (invite.email as string).trim().toLowerCase())
  )

  const { alreadyMember, alreadyInvited, toInvite } = classifyEmails(
    validEmails,
    memberEmails,
    pendingInviteEmails
  )

  if (toInvite.length === 0) {
    return { data: { sent: [], invalidFormat, alreadyMember, alreadyInvited, emailDeliveryFailed: false } }
  }

  const rows = toInvite.map((email) => ({
    team_id: teamId,
    token: generateInviteToken(),
    email,
    created_by: user.id,
    expires_at: inviteExpiryTimestamp(),
  }))

  const { data: inserted, error: insertError } = await supabase
    .from('team_invites')
    .insert(rows)
    .select('token, email')
  if (insertError) {
    return { error: insertError.message }
  }

  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol = headersList.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  const origin = `${protocol}://${host}`

  const { data: inviterProfile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()
  const inviterName = inviterProfile?.full_name ?? inviterProfile?.email ?? 'Một thành viên'

  const { error: sendError } = await resend.batch.send(
    (inserted ?? []).map((invite) => {
      const joinUrl = `${origin}/join/${invite.token}`
      const emailInput = { teamName, inviterName, joinUrl }
      return {
        from: 'Candor <onboarding@resend.dev>',
        to: [invite.email as string],
        subject: buildInviteEmailSubject(emailInput),
        html: buildInviteEmailHtml(emailInput),
      }
    })
  )

  return {
    data: {
      sent: sendError ? [] : toInvite,
      invalidFormat,
      alreadyMember,
      alreadyInvited,
      emailDeliveryFailed: Boolean(sendError),
    },
  }
}
