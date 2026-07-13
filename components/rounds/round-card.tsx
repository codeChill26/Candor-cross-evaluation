import Link from 'next/link'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getEffectiveStatus } from '@/lib/utils/round-status'

type Round = { id: string; title: string; status: 'draft' | 'open' | 'closed'; deadline: string }

export function RoundCard({ round, progress }: { round: Round; progress: { submitted: number; total: number } }) {
  const effective = getEffectiveStatus(round.status, round.deadline)

  return (
    <Link href={`/rounds/${round.id}`}>
      <Card className="transition-colors hover:border-primary">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{round.title}</CardTitle>
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
