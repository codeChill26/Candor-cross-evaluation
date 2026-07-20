'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { deleteTeam } from '@/app/teams/[teamId]/actions'

// Deleting a team wipes every round and every piece of feedback in it, with no
// undo — so the confirm requires retyping the team name, not just a click.
export function DeleteTeamDialog({ teamId, teamName }: { teamId: string; teamName: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const canDelete = confirmText.trim() === teamName.trim()

  async function handleDelete() {
    if (!canDelete) return
    setPending(true)
    setError(null)
    const result = await deleteTeam(teamId)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setOpen(false)
    router.push('/teams')
    router.refresh()
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setConfirmText('')
      setError(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="destructive">Xóa team</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Xóa team “{teamName}”?</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <p className="font-medium text-destructive">Hành động này không thể hoàn tác.</p>
            <p className="mt-1 text-muted-foreground">
              Toàn bộ dữ liệu của team sẽ bị xóa vĩnh viễn: thành viên, lời mời, mọi vòng đánh giá
              cùng tất cả câu trả lời và báo cáo.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-team-name">
              Gõ <span className="font-semibold text-foreground">{teamName}</span> để xác nhận
            </Label>
            <Input
              id="confirm-team-name"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={teamName}
              autoComplete="off"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Hủy
            </Button>
            <Button type="button" variant="destructive" disabled={!canDelete || pending} onClick={handleDelete}>
              {pending ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
