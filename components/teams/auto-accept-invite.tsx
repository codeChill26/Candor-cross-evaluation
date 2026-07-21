'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { acceptInvite } from '@/app/join/[token]/actions'

// Accepts the invite automatically on mount (the visitor is already logged in
// by the time this renders), then sends them straight to the team dashboard —
// no second "join" click. acceptInvite is idempotent (already-a-member counts
// as success), so the StrictMode double-mount is harmless; the ref guard just
// avoids a double redirect.
export function AutoAcceptInvite({ teamName, token }: { teamName: string; token: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    acceptInvite(token).then((result) => {
      if ('error' in result) {
        setError(result.error)
        return
      }
      router.replace(`/teams/${result.data.teamId}`)
    })
  }, [token, router])

  return (
    <Card className="mx-auto mt-24 max-w-sm">
      <CardHeader>
        <CardTitle>{error ? 'Không thể tham gia' : `Đang tham gia ${teamName}…`}</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Vui lòng chờ trong giây lát.</p>
        )}
      </CardContent>
    </Card>
  )
}
