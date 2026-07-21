import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, BadgeCheck, Lock, Sparkles, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { ShuffleDeck } from '@/components/marketing/shuffle-deck'

const STEPS = [
  {
    number: '01',
    title: 'Tạo team và mời đồng đội',
    description: 'Mời qua link hoặc email chỉ trong vài giây.',
  },
  {
    number: '02',
    title: 'Mở vòng đánh giá',
    description: 'Đặt tên, deadline và bộ câu hỏi cho cả nhóm.',
  },
  {
    number: '03',
    title: 'Thu thập phản hồi ẩn danh',
    description: 'Người tạo vòng cũng không thấy ai viết gì cho ai.',
  },
  {
    number: '04',
    title: 'Nhận báo cáo khi vòng đóng',
    description: 'Kết quả được mở theo đúng nhịp, tránh bias khi xem sớm.',
  },
]

const FEATURES = [
  {
    icon: Lock,
    title: 'Ẩn danh thật sự',
    description: 'Cấu trúc lưu trữ không gắn phản hồi với danh tính người viết.',
  },
  {
    icon: Sparkles,
    title: 'Trải nghiệm tinh gọn',
    description: 'Hiệu ứng chuyển động nhẹ, bề mặt kính mờ và nhịp tương tác rõ ràng.',
  },
  {
    icon: Users,
    title: 'Dành cho team nhỏ và vừa',
    description: 'Thiết kế để dùng nhanh cho các nhóm công việc, review và retro.',
  },
]

export function LandingPage() {
  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.25),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(37,99,235,0.18),_transparent_26%),linear-gradient(180deg,_#f8fbff_0%,_#eef6ff_45%,_#f8fafc_100%)] text-foreground dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.22),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(37,99,235,0.16),_transparent_26%),linear-gradient(180deg,_#020617_0%,_#0f172a_45%,_#111827_100%)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-300/25 blur-3xl animate-float" />
        <div className="absolute right-[-6rem] top-28 h-72 w-72 rounded-full bg-sky-400/20 blur-3xl animate-float-slow" />
      </div>

      <header className="relative mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/Logo_Header.png"
            alt="Candor"
            width={1536}
            height={1024}
            priority
            className="h-11 w-auto object-contain"
          />
          <span className="text-base font-semibold tracking-tight sm:text-lg">Candor</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link href="/login" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            Đăng nhập
          </Link>
          <Link href="/register">
            <Button size="sm">Bắt đầu</Button>
          </Link>
        </div>
      </header>

      <main className="relative mx-auto flex max-w-7xl flex-col gap-16 px-4 pb-20 sm:px-6 lg:px-8">
        <section className="grid gap-10 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-14">
          <div className="space-y-7 animate-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white/70 px-4 py-2 text-sm text-primary shadow-sm backdrop-blur-xl dark:bg-white/10">
              <BadgeCheck className="size-4" />
              Đánh giá chéo ẩn danh cho team
            </div>

            <div className="space-y-5">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                Phản hồi thật lòng, giao diện đủ tinh tế để mọi người muốn dùng.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                Candor biến review nội bộ thành một workspace rõ ràng, kín đáo và mượt mà. Từ tạo team,
                mời người tham gia cho đến xem báo cáo, mọi bước đều có nhịp chuyển động nhẹ như kính.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/register">
                <Button size="lg" className="shadow-xl shadow-primary/20">
                  Tạo workspace
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline">
                  Đăng nhập
                </Button>
              </Link>
              <Link href="/rounds/new">
                <Button size="lg" variant="ghost">
                  Tạo vòng nhanh
                </Button>
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {FEATURES.map((feature) => {
                const Icon = feature.icon

                return (
                  <Card key={feature.title} className="glass-card animate-fade-up">
                    <CardHeader className="space-y-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Icon className="size-5" aria-hidden />
                      </div>
                      <CardTitle className="text-base">{feature.title}</CardTitle>
                      <CardDescription>{feature.description}</CardDescription>
                    </CardHeader>
                  </Card>
                )
              })}
            </div>
          </div>

          <div className="relative flex justify-center lg:justify-end">
            <div className="absolute inset-0 -z-10 mx-auto h-[26rem] w-[26rem] rounded-full bg-primary/10 blur-3xl" />
            <div className="glass-card w-full max-w-xl rounded-[2rem] p-5 shadow-[0_30px_120px_-50px_rgba(15,23,42,0.4)] animate-fade-up">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="font-mono text-[11px] tracking-[0.28em] text-muted-foreground uppercase">
                    Overview
                  </p>
                  <h2 className="mt-1 text-xl font-semibold">Một vòng đánh giá điển hình</h2>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  Live
                </span>
              </div>
              <ShuffleDeck />
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          {STEPS.map((step) => (
            <Card key={step.number} className="glass-card animate-fade-up">
              <CardHeader className="space-y-3">
                <p className="font-mono text-xs tracking-[0.3em] text-primary">{step.number}</p>
                <CardTitle className="text-lg">{step.title}</CardTitle>
                <CardDescription>{step.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="space-y-4 animate-fade-up">
            <p className="font-mono text-xs tracking-[0.3em] text-primary uppercase">Privacy by design</p>
            <h2 className="text-3xl font-semibold tracking-tight text-balance">
              Không phải cam kết. Là cách dữ liệu được thiết kế ngay từ đầu.
            </h2>
            <p className="max-w-xl text-muted-foreground leading-7">
              Mỗi phản hồi được lưu theo cách không gắn trực tiếp tới người viết. Điều đó giúp team nhận
              được góp ý thật hơn, trong khi phần hiển thị vẫn đủ mềm mại và hiện đại để dùng hằng ngày.
            </p>
          </div>

          <Card className="glass-card overflow-hidden animate-fade-up">
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-base">Cấu trúc dữ liệu</CardTitle>
              <CardDescription>Không giữ reviewer_id trong bảng phản hồi.</CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              <pre className="overflow-x-auto rounded-2xl border border-border/60 bg-slate-950 px-4 py-4 font-mono text-[11px] leading-6 text-slate-100">
                {`table responses (
  id           uuid
  round_id     uuid
  target_id    uuid
  answers_json jsonb
  submitted_at timestamptz
)

-- Không lưu liên kết ngược tới người viết.`}
              </pre>
            </CardContent>
          </Card>
        </section>

        <section className="glass-card flex flex-col items-start justify-between gap-6 rounded-[2rem] p-6 md:flex-row md:items-center md:p-8 animate-fade-up">
          <div className="space-y-2">
            <p className="font-mono text-xs tracking-[0.3em] text-primary uppercase">Ready</p>
            <h2 className="text-2xl font-semibold tracking-tight">
              Sẵn sàng chuyển team của bạn sang một quy trình review sạch hơn?
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Bắt đầu bằng một workspace nhỏ, mời đồng đội và thử một vòng đánh giá ngay hôm nay.
            </p>
          </div>
          <Link href="/register">
            <Button size="lg">
              Tạo team đầu tiên
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        </section>
      </main>

      <footer className="relative mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 pb-8 text-center text-sm text-muted-foreground sm:px-6 lg:px-8">
        <Image
          src="/Logo_Footer.png"
          alt="Candor"
          width={1536}
          height={1024}
          className="h-12 w-auto object-contain opacity-80"
        />
        Candor dành cho team muốn nghe thật, nhìn đẹp và đi nhanh.
      </footer>
    </div>
  )
}
