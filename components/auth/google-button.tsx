'use client'

import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

export function GoogleButton() {
  async function handleClick() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <Button type="button" variant="outline" className="w-full" onClick={handleClick}>
      Tiếp tục với Google
    </Button>
  )
}
