'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { parseEmailList, MAX_EMAILS_PER_SUBMIT } from '@/lib/utils/parse-email-list'
import { createBulkInvites, type BulkInviteSummary } from '@/app/teams/[teamId]/actions'

export function BulkInviteForm({ teamId, teamName }: { teamId: string; teamName: string }) {
  const [raw, setRaw] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [summary, setSummary] = useState<BulkInviteSummary | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setRaw((prev) => (prev.trim() ? `${prev}\n${text}` : text))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const emails = parseEmailList(raw)
    if (emails.length === 0) {
      setError('Nhập ít nhất 1 email')
      return
    }
    if (emails.length > MAX_EMAILS_PER_SUBMIT) {
      setError(`Tối đa ${MAX_EMAILS_PER_SUBMIT} email mỗi lượt gửi — hiện có ${emails.length}`)
      return
    }
    setPending(true)
    const result = await createBulkInvites(teamId, teamName, emails)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setSummary(result.data)
  }

  if (summary) {
    const total =
      summary.sent.length + summary.invalidFormat.length + summary.alreadyMember.length + summary.alreadyInvited.length
    return (
      <div className="space-y-3">
        <p className="text-sm">
          Đã gửi {summary.sent.length}/{total}
        </p>
        {summary.invalidFormat.length > 0 && (
          <p className="text-sm text-destructive">Sai định dạng: {summary.invalidFormat.join(', ')}</p>
        )}
        {summary.alreadyMember.length > 0 && (
          <p className="text-sm text-muted-foreground">Đã là thành viên: {summary.alreadyMember.join(', ')}</p>
        )}
        {summary.alreadyInvited.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Đã có lời mời còn hạn: {summary.alreadyInvited.join(', ')}
          </p>
        )}
        {summary.emailDeliveryFailed && (
          <p className="text-sm text-destructive">
            Gửi email thất bại, nhưng link mời đã được tạo — dùng tab &quot;Link mời&quot; để lấy lại.
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setSummary(null)
            setRaw('')
          }}
        >
          Mời thêm
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="bulk-emails">Danh sách email (phân cách bằng dấu phẩy hoặc xuống dòng)</Label>
        <Textarea
          id="bulk-emails"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={'a@congty.com, b@congty.com\nc@congty.com'}
          rows={6}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="bulk-emails-file">Hoặc tải lên file .csv/.txt (mỗi dòng 1 email)</Label>
        <input
          ref={fileInputRef}
          id="bulk-emails-file"
          type="file"
          accept=".csv,.txt"
          onChange={handleFileChange}
          className="block w-full text-sm"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Đang gửi...' : 'Gửi lời mời'}
      </Button>
    </form>
  )
}
