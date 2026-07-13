import type { AggregateResult } from '@/lib/report/aggregate'

export function ReportSummary({ summary }: { summary: AggregateResult[] }) {
  return (
    <div className="space-y-4">
      {summary.map((item, index) => (
        <div key={index} className="rounded-lg border p-4">
          <p className="font-medium">{item.prompt}</p>
          {item.type === 'rating' && (
            <p className="mt-2 text-sm text-muted-foreground">
              Điểm trung bình:{' '}
              <span className="font-semibold text-foreground">{item.average.toFixed(1)}/5</span>{' '}
              ({item.count} đánh giá)
            </p>
          )}
          {item.type === 'multiple_choice' && (
            <div className="mt-2 space-y-1">
              {Object.entries(item.counts).map(([option, count]) => (
                <div key={option} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{option}</span>
                  <span>
                    {count}/{item.total}
                  </span>
                </div>
              ))}
            </div>
          )}
          {item.type === 'text' && (
            <ul className="mt-2 space-y-2">
              {item.answers.length === 0 && (
                <li className="text-sm text-muted-foreground">Chưa có góp ý nào.</li>
              )}
              {item.answers.map((answer, answerIndex) => (
                <li key={answerIndex} className="rounded-md bg-muted p-2 text-sm">
                  {answer}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}
