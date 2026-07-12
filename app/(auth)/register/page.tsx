import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { RegisterForm } from '@/components/auth/register-form'
import { GoogleButton } from '@/components/auth/google-button'

export default function RegisterPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tạo tài khoản Candor</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <RegisterForm />
        <div className="flex items-center gap-2">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">HOẶC</span>
          <Separator className="flex-1" />
        </div>
        <GoogleButton />
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
