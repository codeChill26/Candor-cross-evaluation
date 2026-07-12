'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { createInvite } from '@/app/teams/[teamId]/actions'

export function InviteDialog({ teamId }: { teamId: string }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const formData = new FormData()
    formData.set('email', email)
    const result = await createInvite(teamId, formData)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setInviteUrl(`${window.location.origin}/join/${result.data.token}`)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setEmail('')
      setError(null)
      setInviteUrl(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline">Mời thành viên</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mời thành viên vào team</DialogTitle>
        </DialogHeader>
        {inviteUrl ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Link mời (hết hạn sau 7 ngày) — gửi cho người bạn muốn mời:
            </p>
            <Input readOnly value={inviteUrl} onFocus={(e) => e.currentTarget.select()} />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email (tùy chọn — để trống để tạo link mời mở)</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ban@congty.com"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? 'Đang tạo...' : 'Tạo link mời'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
