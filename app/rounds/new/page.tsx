import { CreateOpenRoundForm } from '@/components/rounds/create-open-round-form'

export default function NewOpenRoundPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6 py-12">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Tạo đánh giá nhanh</h1>
        <p className="text-sm text-muted-foreground">
          Không cần tài khoản. Bạn cũng sẽ tham gia đánh giá cùng mọi người bạn mời.
        </p>
      </div>
      <CreateOpenRoundForm />
    </div>
  )
}
