'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { usePollingRefresh } from '@/lib/hooks/use-polling-refresh'
import { MIN_PARTICIPANTS } from '@/lib/rounds/constants'
import { startRound } from '@/app/rounds/[roundId]/start-actions'

export function CollectingPanel({
  roundId,
  title,
  participantNames,
  isCreator,
  joinUrl,
}: {
  roundId: string
  title: string
  participantNames: string[]
  isCreator: boolean
  joinUrl: string
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  // Fallback so the roster fills in and the "Bắt đầu" auto-advance still fire
  // without a reload even if round_participants/rounds aren't in the realtime
  // publication yet. Short interval — a waiting room should feel live.
  usePollingRefresh(3500)

  // Live waiting room. Subscribing runs in the browser (a serverless function
  // can't hold the socket). On any change we just re-run the server component
  // via router.refresh() — it re-fetches the roster with display names under
  // RLS, so we don't duplicate that query here.
  //   - round_participants INSERT → a new person joined, refresh the list.
  //   - rounds UPDATE → the creator hit "Bắt đầu" (status → open), so every
  //     waiting participant auto-advances to the review screen.
  // Requires the two tables to be in the `supabase_realtime` publication
  // (see supabase/realtime-setup.sql).
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`round-collecting-${roundId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'round_participants', filter: `round_id=eq.${roundId}` },
        () => router.refresh()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rounds', filter: `id=eq.${roundId}` },
        () => router.refresh()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roundId, router])

  async function handleStart() {
    setPending(true)
    setError(null)
    const result = await startRound(roundId)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">
        Đang chờ người tham gia — chia sẻ link này cho mọi người:
      </p>
      <Input readOnly value={joinUrl} onFocus={(e) => e.currentTarget.select()} />
      <div className="space-y-2">
        <p className="text-sm font-medium">Đã tham gia ({participantNames.length}):</p>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {participantNames.map((name, i) => (
            <li key={i}>{name}</li>
          ))}
        </ul>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {isCreator && (
        <Button onClick={handleStart} disabled={pending || participantNames.length < MIN_PARTICIPANTS}>
          {pending
            ? 'Đang bắt đầu...'
            : participantNames.length < MIN_PARTICIPANTS
              ? `Cần ít nhất ${MIN_PARTICIPANTS} người tham gia`
              : 'Bắt đầu đánh giá'}
        </Button>
      )}
    </div>
  )
}
