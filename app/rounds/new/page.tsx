import type { Metadata } from 'next'
import { CreateOpenRoundForm } from '@/components/rounds/create-open-round-form'

// Public entry point — the strongest landing target for "đánh giá nội bộ"
// after the homepage, so it gets its own title/description/canonical.
export const metadata: Metadata = {
  title: 'Tạo đánh giá nội bộ nhanh — không cần tài khoản',
  description:
    'Tạo vòng đánh giá nội bộ ẩn danh cho nhóm trong 1 phút: soạn câu hỏi, gửi link, mọi người đánh giá chéo và nhận báo cáo ẩn danh. Miễn phí, không cần đăng ký.',
  alternates: { canonical: '/rounds/new' },
}

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
