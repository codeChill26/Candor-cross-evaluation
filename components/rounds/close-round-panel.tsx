'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { closeRound } from '@/app/rounds/[roundId]/actions'
import type { RoundProgress } from '@/lib/rounds/progress'

// Creator-only panel: live submission progress plus the close control.
// Shows counts only — never who has or hasn't submitted, which would let the
// creator match a report entry to a reviewer.
export function CloseRoundPanel({
  roundId,
  progress,
}: {
  roundId: string
  progress: RoundProgress
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingForce, setConfirmingForce] = useState(false)

  const blocked = progress.pending > 0
  const percent =
    progress.totalPairs > 0 ? Math.round((progress.submitted / progress.totalPairs) * 100) : 0

  async function handleClose(force: boolean) {
    setPending(true)
    setError(null)
    const result = await closeRound(roundId, force)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">
          Đã nộp {progress.submitted}/{progress.totalPairs} lượt đánh giá
        </p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
        </div>
        <p className={`text-sm ${blocked ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
          {blocked
            ? `Còn ${progress.pending} người chưa nộp đánh giá nào`
            : 'Tất cả thành viên đã nộp ít nhất 1 đánh giá ✓'}
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {confirmingForce ? (
        <div className="space-y-3 rounded-lg border border-amber-500/50 bg-amber-50 p-3 dark:bg-amber-950/30">
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Vẫn còn {progress.pending} người chưa nộp. Đóng bây giờ thì họ{' '}
            <strong>không thể nộp nữa</strong> và báo cáo sẽ mở cho mọi người. Chắc chưa?
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={pending} onClick={() => handleClose(true)}>
              {pending ? 'Đang đóng...' : 'Xác nhận đóng'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => setConfirmingForce(false)}
            >
              Quay lại
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={pending || blocked} onClick={() => handleClose(false)}>
            {pending ? 'Đang đóng...' : 'Đóng vòng'}
          </Button>
          {blocked && (
            <Button size="sm" variant="outline" onClick={() => setConfirmingForce(true)}>
              Vẫn đóng
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
