import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CreateRoundForm } from '@/components/rounds/create-round-form'

export default async function NewRoundPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params

  // Only the team owner may create rounds — block direct navigation too, not
  // just the hidden button.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: myMembership } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user?.id ?? '')
    .maybeSingle()
  if (myMembership?.role !== 'owner') {
    redirect(`/teams/${teamId}/rounds`)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Tạo vòng đánh giá mới</h1>
      <CreateRoundForm teamId={teamId} />
    </div>
  )
}
