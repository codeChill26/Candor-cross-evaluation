import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { RoundCard } from '@/components/rounds/round-card'
import { RoundsLive } from '@/components/rounds/rounds-live'
import { getRoundProgress } from './progress-actions'

export default async function RoundsPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params
  const supabase = await createClient()

  const { data: rounds } = await supabase
    .from('rounds')
    .select('id, title, status, deadline')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })

  const { count: participantCount } = await supabase
    .from('team_members')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', teamId)

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: myMembership } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user?.id ?? '')
    .maybeSingle()
  const isOwner = myMembership?.role === 'owner'

  const roundsWithProgress = await Promise.all(
    (rounds ?? []).map(async (round) => ({
      round,
      progress: await getRoundProgress(round.id, participantCount ?? 0),
    }))
  )

  return (
    <div className="space-y-6">
      <RoundsLive teamId={teamId} />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Vòng đánh giá</h1>
        {isOwner && (
          <Link href={`/teams/${teamId}/rounds/new`}>
            <Button>Tạo vòng mới</Button>
          </Link>
        )}
      </div>
      {roundsWithProgress.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {roundsWithProgress.map(({ round, progress }) => (
            <RoundCard key={round.id} round={round} progress={progress} />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">Chưa có vòng đánh giá nào. Tạo vòng đầu tiên.</p>
      )}
    </div>
  )
}
