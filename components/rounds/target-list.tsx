import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type Target = { userId: string; fullName: string | null; email: string; reviewed: boolean }

export function TargetList({ roundId, targets }: { roundId: string; targets: Target[] }) {
  return (
    <ul className="divide-y rounded-lg border">
      {targets.map((t) => (
        <li key={t.userId} className="flex items-center justify-between p-4">
          <span>{t.fullName ?? t.email}</span>
          {t.reviewed ? (
            <Badge variant="secondary">Đã đánh giá</Badge>
          ) : (
            <Link href={`/rounds/${roundId}/review/${t.userId}`}>
              <Button size="sm">Đánh giá</Button>
            </Link>
          )}
        </li>
      ))}
    </ul>
  )
}
