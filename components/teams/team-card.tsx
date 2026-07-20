import Link from 'next/link'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'

export function TeamCard({ id, name }: { id: string; name: string }) {
  return (
    <Link href={`/teams/${id}`} className="group block h-full">
      <Card className="glass-card h-full transition-all duration-300 group-hover:-translate-y-1 group-hover:border-primary/30 group-hover:shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)]">
        <CardHeader className="space-y-2">
          <p className="font-mono text-[11px] tracking-[0.28em] text-primary uppercase">Team</p>
          <CardTitle className="text-base">{name}</CardTitle>
        </CardHeader>
      </Card>
    </Link>
  )
}
