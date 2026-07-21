'use server'

import { createClient } from '@/lib/supabase/server'
import { displayNameSchema } from '@/lib/validations/round'

type Result = { error: string } | { data: true }

// Sets the current user's display name on their profile (and syncs auth
// metadata). profiles RLS `profiles_update_self` allows updating one's own row.
export async function updateDisplayName(name: string): Promise<Result> {
  const parsed = displayNameSchema.safeParse(name)
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

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: parsed.data })
    .eq('id', user.id)
  if (error) {
    return { error: error.message }
  }

  await supabase.auth.updateUser({ data: { full_name: parsed.data } })
  return { data: true }
}
