import Link from 'next/link'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getEffectiveStatus } from '@/lib/utils/round-status'

type Round = { id: string; title: string; status: 'draft' | 'open' | 'closed'; deadline: string }

export function RoundCard({ round, progress }: { round: Round; progress: { submitted: number; total: number } }) {
  const effective = getEffectiveStatus(round.status, round.deadline)

  return (
    <Link href={`/rounds/${round.id}`} className="group block h-full">
      <Card className="glass-card h-full transition-all duration-300 group-hover:-translate-y-1 group-hover:border-primary/30 group-hover:shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)]">
        <CardHeader className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-base leading-6">{round.title}</CardTitle>
            <Badge variant={effective === 'open' ? 'default' : 'secondary'}>
              {effective === 'open' ? 'Đang mở' : 'Đã đóng'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {progress.submitted}/{progress.total} đã nộp
          </p>
        </CardHeader>
      </Card>
    </Link>
  )
}
