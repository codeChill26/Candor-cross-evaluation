'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createTeamSchema } from '@/lib/validations/team'
import { generateSlug } from '@/lib/utils/slug'
import { dbError } from '@/lib/utils/action-error'

type CreateTeamResult =
  | { error: string }
  | { data: { id: string; name: string; slug: string } }

export async function createTeam(formData: FormData): Promise<CreateTeamResult> {
  const parsed = createTeamSchema.safeParse({ name: formData.get('name') })
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
  if (user.is_anonymous) {
    return { error: 'Vui lòng tạo tài khoản trước khi tạo team' }
  }

  const slug = generateSlug(parsed.data.name)
  const id = crypto.randomUUID()

  // No `.select()` here (return=minimal). The owner's team_members row is
  // created by the handle_new_team AFTER trigger, which fires only at the end
  // of this statement — so at RETURNING time the caller isn't a member yet and
  // the teams SELECT policy (teams_select_member) would reject the returned
  // row with a 42501. We generate the id ourselves and return local values
  // instead of reading the row back.
  const { error } = await supabase
    .from('teams')
    .insert({ id, name: parsed.data.name, slug, created_by: user.id })

  if (error) {
    return dbError('createTeam', error)
  }

  revalidatePath('/teams')
  return { data: { id, name: parsed.data.name, slug } }
}
