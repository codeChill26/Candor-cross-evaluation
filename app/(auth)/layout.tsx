import { PageShell } from '@/components/layout/page-shell'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageShell
      title="Đăng nhập workspace"
      description="Truy cập tài khoản để quản lý team và các vòng đánh giá."
      eyebrow="Candor access"
      homeHref="/"
    >
      <div className="mx-auto flex w-full max-w-md items-center justify-center py-6">
        <div className="glass-card w-full rounded-[2rem] p-6 sm:p-8">{children}</div>
      </div>
    </PageShell>
  )
}
