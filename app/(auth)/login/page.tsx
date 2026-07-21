import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoginForm } from '@/components/auth/login-form'

export const metadata: Metadata = {
  title: 'Đăng nhập',
  description: 'Đăng nhập Candor để quản lý team và xem báo cáo đánh giá nội bộ của bạn.',
  alternates: { canonical: '/login' },
}

export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Đăng nhập vào Candor</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <LoginForm />
        <p className="text-center text-sm text-muted-foreground">
          Chưa có tài khoản?{' '}
          <Link href="/register" className="text-primary underline underline-offset-4">
            Đăng ký
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
