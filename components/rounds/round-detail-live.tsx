'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usePollingRefresh } from '@/lib/hooks/use-polling-refresh'

// Keeps an open round's detail page current without a reload:
//   - the creator's submission progress ticks up as people submit
//   - when the round is closed, everyone's page flips to "Đã đóng" and the
//     "Xem báo cáo" link appears on its own
// Progress comes from submission_status, which RLS hides from everyone but its
// own reviewer, so realtime can't deliver it — polling re-runs the server
// component (which aggregates via the admin client) instead. The rounds
// subscription just makes the close flip feel instant. Renders nothing.
export function RoundDetailLive({ roundId }: { roundId: string }) {
  const router = useRouter()
  usePollingRefresh(4000)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`round-detail-${roundId}`)
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

  return null
}
