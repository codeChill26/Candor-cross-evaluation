import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { JoinOpenRoundForm } from '@/components/rounds/join-open-round-form'

export default async function JoinOpenRoundPage({ params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params
  const admin = createAdminClient()

  const { data: round } = await admin
    .from('rounds')
    .select('title, status, team_id')
    .eq('id', roundId)
    .maybeSingle()

  if (!round || round.team_id !== null) {
    notFound()
  }
  if (round.status !== 'collecting') {
    return (
      <p className="mx-auto mt-24 max-w-sm text-sm text-muted-foreground">
        Vòng đánh giá này không còn nhận người tham gia mới.
      </p>
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let existingName: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()
    existingName = profile?.full_name ?? null
  }

  return (
    <div className="mx-auto mt-24 max-w-sm space-y-4">
      <h1 className="text-xl font-semibold">Tham gia: {round.title}</h1>
      <JoinOpenRoundForm roundId={roundId} existingName={existingName} />
    </div>
  )
}
