import { CreateRoundForm } from '@/components/rounds/create-round-form'

export default async function NewRoundPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Tạo vòng đánh giá mới</h1>
      <CreateRoundForm teamId={teamId} />
    </div>
  )
}
