'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { joinOpenRound } from '@/app/rounds/[roundId]/join/actions'

export function JoinOpenRoundForm({
  roundId,
  existingName,
}: {
  roundId: string
  existingName: string | null
}) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!existingName && displayName.trim().length === 0) {
      setError('Nhập tên hiển thị')
      return
    }
    setPending(true)
    setError(null)
    const result = await joinOpenRound(roundId, displayName.trim())
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    router.push(`/rounds/${roundId}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {existingName ? (
        <p className="text-sm">
          Bạn sẽ tham gia với tên: <strong>{existingName}</strong>
        </p>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="join-display-name">Tên hiển thị của bạn</Label>
          <Input
            id="join-display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Nguyễn Văn A"
          />
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Đang tham gia...' : 'Tham gia'}
      </Button>
    </form>
  )
}
