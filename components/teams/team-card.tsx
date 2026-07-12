import Link from 'next/link'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'

export function TeamCard({ id, name }: { id: string; name: string }) {
  return (
    <Link href={`/teams/${id}`}>
      <Card className="transition-colors hover:border-primary">
        <CardHeader>
          <CardTitle className="text-base">{name}</CardTitle>
        </CardHeader>
      </Card>
    </Link>
  )
}
