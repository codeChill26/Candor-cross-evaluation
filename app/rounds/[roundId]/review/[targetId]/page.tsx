import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ResponseForm } from '@/components/rounds/response-form'

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ roundId: string; targetId: string }>
}) {
  const { roundId, targetId } = await params
  const supabase = await createClient()

  const { data: round } = await supabase.from('rounds').select('id, title').eq('id', roundId).maybeSingle()
  if (!round) notFound()

  // Already submitted this target? It's locked (anonymised) — send them back to
  // the list instead of showing an editable form that would fail on submit.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: already } = await supabase
    .from('submission_status')
    .select('target_id')
    .eq('round_id', roundId)
    .eq('reviewer_id', user?.id ?? '')
    .eq('target_id', targetId)
    .maybeSingle()
  if (already) redirect(`/rounds/${roundId}`)

  const { data: questions } = await supabase
    .from('round_questions')
    .select('id, type, prompt, options_json, required')
    .eq('round_id', roundId)
    .order('order_index', { ascending: true })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{round.title}</h1>
      <ResponseForm roundId={roundId} targetId={targetId} questions={questions ?? []} />
    </div>
  )
}
