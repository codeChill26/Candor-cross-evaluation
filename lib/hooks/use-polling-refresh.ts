'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// "No-F5" fallback for pages that also subscribe to Supabase Realtime.
// Realtime only delivers changes for tables in the `supabase_realtime`
// publication; until that SQL is run (or if the socket drops), this interval
// re-runs the server component so the UI still catches up on its own. It also
// covers events the Realtime subscription doesn't listen for (e.g. DELETE).
// Paused while the tab is hidden so a backgrounded tab isn't polling for nothing,
// and fires once immediately when the tab regains focus.
export function usePollingRefresh(intervalMs = 4000) {
  const router = useRouter()

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') router.refresh()
    }
    const id = setInterval(refreshIfVisible, intervalMs)
    document.addEventListener('visibilitychange', refreshIfVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', refreshIfVisible)
    }
  }, [intervalMs, router])
}
