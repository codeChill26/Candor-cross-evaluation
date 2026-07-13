import { Card, CardContent } from '@/components/ui/card'
import type { ReportQuestion, ReportAnswer } from '@/lib/report/aggregate'

export function ResponseCard({ questions, answers }: { questions: ReportQuestion[]; answers: ReportAnswer[] }) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        {questions.map((q) => {
          const answer = answers.find((a) => a.question_id === q.id)
          if (!answer) return null
          return (
            <div key={q.id}>
              <p className="text-sm font-medium text-muted-foreground">{q.prompt}</p>
              <p className="text-sm">{q.type === 'rating' ? `${answer.value}/5` : answer.value}</p>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
