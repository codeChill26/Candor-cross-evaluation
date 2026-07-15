'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
        <Button onClick={handleStart} disabled={pending || participantNames.length < 2}>
          {pending
            ? 'Đang bắt đầu...'
            : participantNames.length < 2
              ? 'Cần ít nhất 2 người tham gia'
              : 'Bắt đầu đánh giá'}
        </Button>
      )}
    </div>
  )
}
