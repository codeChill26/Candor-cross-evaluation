'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { registerSchema, type RegisterInput } from '@/lib/validations/auth'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel, FieldError, FieldSeparator } from '@/components/ui/field'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'

export function RegisterForm() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', password: '' },
  })

  async function onSubmit(values: RegisterInput) {
    setServerError(null)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { full_name: values.fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/teams`,
      },
    })
    if (error) {
      setServerError(error.message)
      return
    }

    if (data.session) {
      router.push('/teams')
      router.refresh()
      return
    }

    setServerError('Đã gửi email xác nhận. Hãy mở email và bấm link để kích hoạt tài khoản.')
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FieldGroup>
        <Field data-invalid={!!errors.fullName}>
          <FieldLabel htmlFor="register-name">Họ và tên</FieldLabel>
          <Input
            id="register-name"
            autoComplete="name"
            placeholder="Nguyễn Văn A"
            {...register('fullName')}
          />
          <FieldError errors={[errors.fullName]} />
        </Field>
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="register-email">Email</FieldLabel>
          <Input
            id="register-email"
            type="email"
            autoComplete="email"
            placeholder="ban@congty.com"
            {...register('email')}
          />
          <FieldError errors={[errors.email]} />
        </Field>
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="register-password">Mật khẩu</FieldLabel>
          <Input
            id="register-password"
            type="password"
            autoComplete="new-password"
            {...register('password')}
          />
          <FieldError errors={[errors.password]} />
        </Field>
        {serverError && <p className="text-sm text-destructive">{serverError}</p>}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          Tạo tài khoản
        </Button>
        <FieldSeparator>hoặc</FieldSeparator>
        <GoogleSignInButton onError={setServerError} />
      </FieldGroup>
    </form>
  )
}
