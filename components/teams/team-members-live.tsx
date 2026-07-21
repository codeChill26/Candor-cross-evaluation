'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usePollingRefresh } from '@/lib/hooks/use-polling-refresh'

// Live team roster: when someone accepts an invite (team_members INSERT) — or is
// removed (DELETE) — every open team page refreshes so the change shows up
// without a manual reload. Realtime gives instant updates once team_members is
// in the `supabase_realtime` publication (see supabase/realtime-setup.sql); the
// polling fallback keeps it working (and covers DELETE) even before that.
// Renders nothing.
export function TeamMembersLive({ teamId }: { teamId: string }) {
  const router = useRouter()
  usePollingRefresh(5000)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`team-members-${teamId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'team_members', filter: `team_id=eq.${teamId}` },
        () => router.refresh()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [teamId, router])

  return null
}
