import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveStatus } from '@/lib/utils/round-status'
import { aggregateReport, type ReportQuestion, type ReportResponse } from '@/lib/report/aggregate'
import { shuffle } from '@/lib/utils/shuffle'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ReportSummary } from '@/components/reports/report-summary'

export default async function ReportPage({ params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params
  const supabase = await createClient()

  const { data: round } = await supabase
    .from('rounds')
    .select('id, title, status, deadline')
    .eq('id', roundId)
    .maybeSingle()
  if (!round) notFound()

  const effective = getEffectiveStatus(round.status, round.deadline)
  if (effective !== 'closed') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Báo cáo chưa khả dụng</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Báo cáo chỉ hiển thị sau khi vòng đánh giá đóng.
          </p>
        </CardContent>
      </Card>
    )
  }

  const { data: questions } = await supabase
    .from('round_questions')
    .select('id, type, prompt, options_json')
    .eq('round_id', roundId)
    .order('order_index', { ascending: true })

  // RLS (responses_select_own_when_closed) already restricts this to the
  // caller's own responses in this closed round — no extra filter needed.
  const { data: responses } = await supabase.from('responses').select('id, answers_json').eq('round_id', roundId)

  const { count: participantCount } = await supabase
    .from('round_participants')
    .select('id', { count: 'exact', head: true })
    .eq('round_id', roundId)

  const questionsForAggregate: ReportQuestion[] = (questions ?? []).map((q) => ({
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    options: q.options_json,
  }))
  const responsesForAggregate: ReportResponse[] = (responses ?? []).map((r) => ({
    id: r.id,
    answers: r.answers_json,
  }))

  // Shuffle each free-text question's answers INDEPENDENTLY: a shared order
  // across questions would let someone line up "answer #1 to Q1" with
  // "answer #1 to Q2" and reconstruct a whole reviewer's submission.
  const summary = aggregateReport(questionsForAggregate, responsesForAggregate).map((r) => {
    if (r.type === 'text') return { ...r, answers: shuffle(r.answers) }
    // Free text typed into "Khác" leaks the same way, so shuffle it too.
    if (r.type === 'choice' || r.type === 'checkbox') {
      return { ...r, otherAnswers: shuffle(r.otherAnswers) }
    }
    return r
  })

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Báo cáo: {round.title}</h1>
      {(participantCount ?? 0) < 4 && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Team này có ít hơn 4 thành viên — với nhóm nhỏ, danh tính người đánh giá có thể bị suy
          đoán qua văn phong hoặc loại trừ, dù hệ thống không lưu bất kỳ liên kết kỹ thuật nào tới
          người viết.
        </p>
      )}
      <ReportSummary summary={summary} />
    </div>
  )
}
