'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { acceptInvite } from '@/app/join/[token]/actions'

export function JoinConfirm({ teamName, token }: { teamName: string; token: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleJoin() {
    setPending(true)
    setError(null)
    const result = await acceptInvite(token)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    router.push(`/teams/${result.data.teamId}`)
  }

  return (
    <Card className="mx-auto mt-24 max-w-sm">
      <CardHeader>
        <CardTitle>Tham gia {teamName}?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Bạn sẽ tham gia team này và có thể đánh giá, được đánh giá trong các vòng đánh giá của
          team.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button className="w-full" onClick={handleJoin} disabled={pending}>
          {pending ? 'Đang tham gia...' : 'Tham gia team'}
        </Button>
      </CardContent>
    </Card>
  )
}
