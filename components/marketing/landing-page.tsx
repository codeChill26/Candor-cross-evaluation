import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ShuffleDeck } from '@/components/marketing/shuffle-deck'

const STEPS = [
  { number: '01', title: 'Tạo team, mời đồng đội', description: 'Qua link mời hoặc email trực tiếp.' },
  { number: '02', title: 'Mở vòng đánh giá', description: 'Đặt tên, deadline, thêm câu hỏi.' },
  {
    number: '03',
    title: 'Mọi người đánh giá tất cả',
    description: 'Không ai được miễn, kể cả người tạo vòng.',
  },
  {
    number: '04',
    title: 'Nhận báo cáo về chính mình',
    description: 'Chỉ mở sau khi vòng đóng, thứ tự xáo trộn.',
  },
]

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <span className="text-lg font-semibold">Candor</span>
        <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
          Đăng nhập
        </Link>
      </header>

      <section className="mx-auto grid max-w-5xl gap-12 px-6 py-16 md:grid-cols-2 md:items-center md:py-24">
        <div className="space-y-6">
          <p className="font-mono text-xs tracking-widest text-primary uppercase">
            Đánh giá chéo ẩn danh
          </p>
          <h1 className="text-4xl leading-tight font-semibold tracking-tight text-balance md:text-5xl">
            Phản hồi thật lòng — vì không ai, kể cả bạn, biết ai đã viết gì.
          </h1>
          <p className="max-w-md text-muted-foreground">
            Candor là công cụ đánh giá chéo 360° cho team nhỏ. Khác với Google Form hay Typeform,
            ẩn danh ở đây không phải lời hứa — nó nằm ngay trong cách dữ liệu được lưu.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/register">
              <Button size="lg">Bắt đầu miễn phí</Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                Đăng nhập
              </Button>
            </Link>
            <Link href="/rounds/new">
              <Button size="lg" variant="ghost">
                Tạo đánh giá nhanh — không cần tài khoản
              </Button>
            </Link>
          </div>
        </div>
        <div className="flex justify-center md:justify-end">
          <ShuffleDeck />
        </div>
      </section>

      <section className="border-t bg-secondary/50">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="font-mono text-sm tracking-widest text-muted-foreground uppercase">
            Cách hoạt động
          </h2>
          <ol className="mt-6 grid gap-8 md:grid-cols-4">
            {STEPS.map((step) => (
              <li key={step.number} className="space-y-2">
                <span className="font-mono text-sm text-primary">{step.number}</span>
                <p className="font-medium">{step.title}</p>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight">
              Không phải chính sách. Là cấu trúc dữ liệu.
            </h2>
            <p className="text-muted-foreground">
              Bảng lưu câu trả lời không có cột nào liên kết tới người viết. Không phải vì chúng
              tôi hứa không xem — mà vì kỹ thuật, không có cách nào để xem.
            </p>
          </div>
          <pre className="overflow-x-auto rounded-xl border bg-card p-5 font-mono text-xs leading-relaxed text-foreground">
            {`table responses (
  id             uuid
  round_id       uuid
  target_id      uuid       -- người được đánh giá
  answers_json   jsonb
  submitted_at   timestamptz
)

-- không có reviewer_id.
-- không thể thêm sau — vì lúc đó sẽ lộ ai viết gì.`}
          </pre>
        </div>
      </section>

      <section className="border-t">
        <div className="mx-auto max-w-5xl px-6 py-16 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">
            Sẵn sàng thẳng thắn với team của bạn?
          </h2>
          <Link href="/register" className="mt-6 inline-block">
            <Button size="lg">Tạo team đầu tiên</Button>
          </Link>
        </div>
      </section>

      <footer className="border-t py-8">
        <p className="text-center text-sm text-muted-foreground">
          Candor — dành cho team muốn nghe thật.
        </p>
      </footer>
    </div>
  )
}
