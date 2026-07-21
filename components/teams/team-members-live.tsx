'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Live team roster: when someone accepts an invite (team_members INSERT), every
// open team page refreshes so the new member shows up without a manual reload.
// Requires team_members in the `supabase_realtime` publication
// (see supabase/realtime-setup.sql). Renders nothing.
export function TeamMembersLive({ teamId }: { teamId: string }) {
  const router = useRouter()

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
