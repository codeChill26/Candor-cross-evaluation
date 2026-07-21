'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usePollingRefresh } from '@/lib/hooks/use-polling-refresh'

// Live team rounds list: a round the owner creates/opens (or progress as people
// submit) shows up for every member without a reload. Realtime gives instant
// updates once `rounds` is in the publication; polling is the fallback and also
// keeps per-round progress fresh. Renders nothing.
export function RoundsLive({ teamId }: { teamId: string }) {
  const router = useRouter()
  usePollingRefresh(5000)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`team-rounds-${teamId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rounds', filter: `team_id=eq.${teamId}` },
        () => router.refresh()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [teamId, router])

  return null
}
