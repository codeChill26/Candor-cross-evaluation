import type { AggregateResult } from '@/lib/report/aggregate'
import { QuestionReport } from './question-report'

export function ReportSummary({ summary }: { summary: AggregateResult[] }) {
  return (
    <div className="space-y-4">
      {summary.map((item, index) => (
        <QuestionReport key={index} result={item} />
      ))}
    </div>
  )
}
