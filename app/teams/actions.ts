'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createTeamSchema } from '@/lib/validations/team'
import { generateSlug } from '@/lib/utils/slug'

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

  const slug = generateSlug(parsed.data.name)

  const { data, error } = await supabase
    .from('teams')
    .insert({ name: parsed.data.name, slug, created_by: user.id })
    .select('id, name, slug')
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/teams')
  return { data }
}
