import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEffectiveStatus } from '@/lib/utils/round-status'
import { Badge } from '@/components/ui/badge'
import { TargetList } from '@/components/rounds/target-list'
import { CollectingPanel } from '@/components/rounds/collecting-panel'
import { CloseRoundPanel } from '@/components/rounds/close-round-panel'
import { RoundDetailLive } from '@/components/rounds/round-detail-live'
import { getSubmissionProgress } from '@/lib/rounds/progress'

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

  // Roster names resolve via the admin client (service role), selecting ONLY
  // full_name — never email. The viewer is already authorized by the RLS round
  // fetch above (notFound otherwise), so this doesn't widen who can see the
  // roster; it just stops emails from being readable. It also lets us drop the
  // broad open-round profiles SELECT policy (see supabase/security-hardening.sql)
  // that otherwise exposed a registered participant's email to anonymous guests.
  const admin = createAdminClient()
  const { data: participants } = await admin
    .from('round_participants')
    .select('user_id, profiles(full_name)')
    .eq('round_id', roundId)

  const isCreator = round.created_by === user?.id

  // Cast: without generated Database types, the embedded `profiles` is
  // typed as an array even though round_participants.user_id -> profiles.id
  // is many-to-one at runtime (same reasoning as the team members page).
  const typedParticipants = (participants ?? []) as unknown as {
    user_id: string
    profiles: { full_name: string | null }
  }[]

  if (round.status === 'collecting') {
    const headersList = await headers()
    const host = headersList.get('host') ?? 'localhost:3000'
    const protocol = headersList.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
    const joinUrl = `${protocol}://${host}/rounds/${roundId}/join`

    const names = typedParticipants.map((p) => p.profiles.full_name ?? 'Ẩn danh')

    return (
      <CollectingPanel
        roundId={roundId}
        title={round.title}
        participantNames={names}
        isCreator={isCreator}
        joinUrl={joinUrl}
      />
    )
  }

  const { data: mySubmissions } = await supabase
    .from('submission_status')
    .select('target_id')
    .eq('round_id', roundId)
    .eq('reviewer_id', user?.id ?? '')

  const reviewedTargetIds = new Set((mySubmissions ?? []).map((s) => s.target_id))

  const targets = typedParticipants
    .filter((p) => p.user_id !== user?.id)
    .map((p) => ({
      userId: p.user_id,
      fullName: p.profiles.full_name,
      reviewed: reviewedTargetIds.has(p.user_id),
    }))

  const effective = getEffectiveStatus(round.status, round.deadline)
  // Aggregate counts for the creator's close decision (counts only — see
  // getSubmissionProgress on why the per-pair map stays server-side).
  const progress = isCreator && effective === 'open' ? await getSubmissionProgress(roundId) : null

  return (
    <div className="space-y-6">
      {/* Live while the round is open: progress ticks up, and a close flips
          every participant's page to the report without a reload. */}
      {effective === 'open' && <RoundDetailLive roundId={roundId} />}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{round.title}</h1>
          <p className="text-sm text-muted-foreground">
            Deadline: {new Date(round.deadline).toLocaleString('vi-VN')}
          </p>
        </div>
        <Badge variant={effective === 'open' ? 'default' : 'secondary'}>
          {effective === 'open' ? 'Đang mở' : 'Đã đóng'}
        </Badge>
      </div>
      {progress && <CloseRoundPanel roundId={roundId} progress={progress} />}
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
