'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { removeMember } from '@/app/teams/[teamId]/actions'

export function RemoveMemberButton({
  teamId,
  memberUserId,
  memberName,
}: {
  teamId: string
  memberUserId: string
  memberName: string
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function handleRemove() {
    if (!window.confirm(`Xóa ${memberName} khỏi team? Họ sẽ mất quyền truy cập team này.`)) return
    setPending(true)
    const result = await removeMember(teamId, memberUserId)
    setPending(false)
    if ('error' in result) {
      window.alert(result.error)
      return
    }
    router.refresh()
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-destructive hover:text-destructive"
      disabled={pending}
      onClick={handleRemove}
    >
      {pending ? 'Đang xóa...' : 'Xóa'}
    </Button>
  )
}
