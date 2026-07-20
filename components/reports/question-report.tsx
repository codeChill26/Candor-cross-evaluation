import type { AggregateResult, OptionCount } from '@/lib/report/aggregate'
import { BarChart, type BarRow } from './bar-chart'

const optionRows = (counts: OptionCount[], max: number): BarRow[] =>
  counts.map((c) => ({
    label: c.option,
    value: c.count,
    max,
    caption: `${c.count} (${max > 0 ? Math.round((c.count / max) * 100) : 0}%)`,
  }))

export function QuestionReport({ result }: { result: AggregateResult }) {
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <p className="font-medium">{result.prompt}</p>

      {result.type === 'rating' && (
        <>
          <p className="text-sm text-muted-foreground">
            Điểm trung bình{' '}
            <span className="text-2xl font-semibold text-foreground">
              {result.average.toFixed(1)}
            </span>
            /5 · {result.count} đánh giá
          </p>
          <BarChart
            rows={result.distribution.map((count, i) => ({
              label: `${i + 1} ★`,
              value: count,
              max: result.count,
              caption: `${count} (${result.count > 0 ? Math.round((count / result.count) * 100) : 0}%)`,
            }))}
          />
        </>
      )}

      {result.type === 'nps' && (
        <>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>
              Điểm trung bình{' '}
              <span className="text-2xl font-semibold text-foreground">
                {result.average.toFixed(1)}
              </span>
              /10
            </span>
            <span>
              NPS{' '}
              <span className="text-xl font-semibold text-foreground">
                {result.score > 0 ? `+${result.score}` : result.score}
              </span>
            </span>
            <span>· {result.count} đánh giá</span>
          </div>
          <BarChart
            rows={result.distribution.map((count, i) => ({
              label: String(i),
              value: count,
              max: result.count,
              caption: String(count),
            }))}
          />
        </>
      )}

      {result.type === 'choice' && (
        <>
          <BarChart rows={optionRows(result.counts, result.total)} />
          <p className="text-xs text-muted-foreground">{result.total} người trả lời</p>
        </>
      )}

      {result.type === 'checkbox' && (
        <>
          <BarChart rows={optionRows(result.counts, result.respondents)} />
          <p className="text-xs text-muted-foreground">
            {result.respondents} người trả lời (chọn được nhiều)
          </p>
        </>
      )}

      {result.type === 'text' && (
        <div className="space-y-2">
          {result.answers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có phản hồi nào.</p>
          ) : (
            result.answers.map((answer, i) => (
              <div key={i} className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
                {answer}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
