import { z } from 'zod'

export const createTeamSchema = z.object({
  name: z.string().min(2, 'Tên team phải có ít nhất 2 ký tự').max(50, 'Tên team tối đa 50 ký tự'),
})

export const inviteMemberSchema = z.object({
  email: z.union([z.email('Email không hợp lệ'), z.undefined()]),
})

export type CreateTeamInput = z.infer<typeof createTeamSchema>
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>
