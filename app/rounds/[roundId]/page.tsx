import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveStatus } from '@/lib/utils/round-status'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TargetList } from '@/components/rounds/target-list'
import { closeRound } from './actions'

export default async function RoundDetailPage({ params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params
  const supabase = await createClient()

  const { data: round } = await supabase
    .from('rounds')
    .select('id, title, status, deadline, created_by')
    .eq('id', roundId)
    .maybeSingle()
  if (!round) notFound()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: participants } = await supabase
    .from('round_participants')
    .select('user_id, profiles(full_name, email)')
    .eq('round_id', roundId)

  const { data: mySubmissions } = await supabase
    .from('submission_status')
    .select('target_id')
    .eq('round_id', roundId)
    .eq('reviewer_id', user?.id ?? '')

  const reviewedTargetIds = new Set((mySubmissions ?? []).map((s) => s.target_id))

  // Cast: without generated Database types, the embedded `profiles` is
  // typed as an array even though round_participants.user_id -> profiles.id
  // is many-to-one at runtime (same reasoning as the team members page).
  const targets = ((participants ?? []) as unknown as {
    user_id: string
    profiles: { full_name: string | null; email: string }
  }[])
    .filter((p) => p.user_id !== user?.id)
    .map((p) => ({
      userId: p.user_id,
      fullName: p.profiles.full_name,
      email: p.profiles.email,
      reviewed: reviewedTargetIds.has(p.user_id),
    }))

  const effective = getEffectiveStatus(round.status, round.deadline)
  const isCreator = round.created_by === user?.id

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{round.title}</h1>
          <p className="text-sm text-muted-foreground">
            Deadline: {new Date(round.deadline).toLocaleString('vi-VN')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={effective === 'open' ? 'default' : 'secondary'}>
            {effective === 'open' ? 'Đang mở' : 'Đã đóng'}
          </Badge>
          {isCreator && effective === 'open' && (
            <form action={async () => { 'use server'; await closeRound(roundId) }}>
              <Button type="submit" variant="outline" size="sm">
                Đóng vòng
              </Button>
            </form>
          )}
        </div>
      </div>
      {effective === 'open' ? (
        <TargetList roundId={roundId} targets={targets} />
      ) : (
        <Link href={`/rounds/${roundId}/report`} className="text-primary underline underline-offset-4">
          Xem báo cáo của bạn
        </Link>
      )}
    </div>
  )
}
