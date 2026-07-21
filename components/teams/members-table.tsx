import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { RemoveMemberButton } from '@/components/teams/remove-member-button'

export type Member = {
  id: string
  user_id: string
  role: string
  profiles: { full_name: string | null; email: string }
}

export function MembersTable({
  members,
  teamId,
  currentUserId,
  isOwner,
}: {
  members: Member[]
  teamId: string
  currentUserId?: string
  isOwner: boolean
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Thành viên</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Vai trò</TableHead>
          {isOwner && <TableHead className="w-0 text-right">Hành động</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((m) => {
          const isMe = m.user_id === currentUserId
          const name = m.profiles.full_name ?? '(chưa đặt tên)'
          return (
            <TableRow key={m.id} className={isMe ? 'bg-primary/5' : undefined} data-me={isMe}>
              <TableCell className="font-medium">
                {name}
                {isMe && <span className="ml-2 text-xs text-primary">(Bạn)</span>}
              </TableCell>
              <TableCell className="text-muted-foreground">{m.profiles.email}</TableCell>
              <TableCell>
                <Badge variant={m.role === 'owner' ? 'default' : 'secondary'}>
                  {m.role === 'owner' ? 'Chủ team' : 'Thành viên'}
                </Badge>
              </TableCell>
              {isOwner && (
                <TableCell className="text-right">
                  {m.role !== 'owner' && (
                    <RemoveMemberButton teamId={teamId} memberUserId={m.user_id} memberName={name} />
                  )}
                </TableCell>
              )}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
