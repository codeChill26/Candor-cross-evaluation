import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export type Member = {
  id: string
  role: string
  profiles: { full_name: string | null; email: string }
}

export function MembersTable({ members }: { members: Member[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Thành viên</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Vai trò</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((m) => (
          <TableRow key={m.id}>
            <TableCell>{m.profiles.full_name ?? '(chưa đặt tên)'}</TableCell>
            <TableCell className="text-muted-foreground">{m.profiles.email}</TableCell>
            <TableCell>
              <Badge variant={m.role === 'owner' ? 'default' : 'secondary'}>
                {m.role === 'owner' ? 'Chủ team' : 'Thành viên'}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
