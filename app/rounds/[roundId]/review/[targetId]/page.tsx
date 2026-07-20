import { notFound } from 'next/navigation'
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
