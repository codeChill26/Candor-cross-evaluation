import { createClient } from '@/lib/supabase/server'
import { CreateTeamDialog } from '@/components/teams/create-team-dialog'
import { TeamCard } from '@/components/teams/team-card'

export default async function TeamsPage() {
  const supabase = await createClient()
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Teams của bạn</h1>
        <CreateTeamDialog />
      </div>
      {teams && teams.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {teams.map((team) => (
            <TeamCard key={team.id} id={team.id} name={team.name} />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">
          Bạn chưa thuộc team nào. Tạo team đầu tiên để bắt đầu.
        </p>
      )}
    </div>
  )
}
