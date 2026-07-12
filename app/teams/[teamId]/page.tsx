import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MembersTable, type Member } from '@/components/teams/members-table'
import { InviteDialog } from '@/components/teams/invite-dialog'

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ teamId: string }>
}) {
  const { teamId } = await params
  const supabase = await createClient()

  const { data: team } = await supabase.from('teams').select('id, name').eq('id', teamId).maybeSingle()
  if (!team) notFound()

  const { data: members } = await supabase
    .from('team_members')
    .select('id, role, profiles(full_name, email)')
    .eq('team_id', teamId)
    .order('joined_at', { ascending: true })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{team.name}</h1>
        <InviteDialog teamId={team.id} />
      </div>
      {/* Cast: without generated Database types, supabase-js can't infer that
          team_members.user_id -> profiles.id is many-to-one, so it types the
          embedded `profiles` as an array even though the FK guarantees one row. */}
      <MembersTable members={(members ?? []) as unknown as Member[]} />
    </div>
  )
}
