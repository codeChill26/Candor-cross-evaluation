import { PageShell } from '@/components/layout/page-shell'

export default function RoundsLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageShell
      title="Vòng đánh giá"
      description="Khu vực công khai cho người tham gia vòng đánh giá và xem báo cáo cá nhân."
      eyebrow="Open rounds"
      homeHref="/"
    >
      <div className="animate-fade-up">{children}</div>
    </PageShell>
  )
}
