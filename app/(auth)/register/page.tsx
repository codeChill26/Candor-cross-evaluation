import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RegisterForm } from '@/components/auth/register-form'

export const metadata: Metadata = {
  title: 'Đăng ký miễn phí',
  description:
    'Tạo tài khoản Candor miễn phí để mở vòng đánh giá nội bộ ẩn danh cho team của bạn.',
  alternates: { canonical: '/register' },
}

export default function RegisterPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tạo tài khoản Candor</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* RegisterForm already ends with its own "hoặc" divider + Google
            button — a second one here was a duplicate. */}
        <RegisterForm />
        <p className="text-center text-sm text-muted-foreground">
          Đã có tài khoản?{' '}
          <Link href="/login" className="text-primary underline underline-offset-4">
            Đăng nhập
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
