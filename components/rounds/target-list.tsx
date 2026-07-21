'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { hasDraft } from '@/lib/rounds/draft'

type Target = { userId: string; fullName: string | null; reviewed: boolean }

// Re-render on cross-tab draft changes; the boolean flips false→true once the
// component is hydrated on the client so localStorage reads happen only there.
function subscribe(callback: () => void) {
  window.addEventListener('storage', callback)
  return () => window.removeEventListener('storage', callback)
}

export function TargetList({ roundId, targets }: { roundId: string; targets: Target[] }) {
  // `reviewed` is server truth (submission_status). Draft state lives in
  // localStorage, so we only read it after hydration to avoid a mismatch.
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )

  return (
    <ul className="divide-y rounded-lg border">
      {targets.map((t) => {
        const isDraft = hydrated && !t.reviewed && hasDraft(roundId, t.userId)
        return (
          <li key={t.userId} className="flex items-center justify-between gap-3 p-4">
            <span className="min-w-0 truncate">{t.fullName ?? 'Ẩn danh'}</span>
            {t.reviewed ? (
              <Badge variant="secondary">Đã nộp</Badge>
            ) : (
              <div className="flex items-center gap-2">
                {isDraft && (
                  <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400">
                    Nháp
                  </Badge>
                )}
                <Link href={`/rounds/${roundId}/review/${t.userId}`}>
                  <Button size="sm" variant={isDraft ? 'outline' : 'default'}>
                    {isDraft ? 'Tiếp tục / Sửa' : 'Đánh giá'}
                  </Button>
                </Link>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
