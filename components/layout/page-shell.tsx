'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { ArrowLeft, CircleDot, Home } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type PageShellProps = {
  children: ReactNode
  title: string
  description?: string
  eyebrow?: string
  homeHref: string
  backHref?: string
  actions?: ReactNode
  className?: string
  contentClassName?: string
}

export function PageShell({
  children,
  title,
  description,
  eyebrow,
  homeHref,
  backHref,
  actions,
  className,
  contentClassName,
}: PageShellProps) {
  const router = useRouter()

  return (
    <div
      className={cn(
        'relative isolate min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.20),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.18),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.92),_rgba(248,250,252,0.98))] text-foreground dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.20),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.16),_transparent_28%),linear-gradient(180deg,_rgba(2,6,23,0.98),_rgba(15,23,42,0.96))]',
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl animate-float" />
        <div className="absolute right-[-6rem] top-28 h-56 w-56 rounded-full bg-sky-300/20 blur-3xl animate-float-slow" />
        <div className="absolute bottom-[-8rem] left-[-4rem] h-80 w-80 rounded-full bg-cyan-200/20 blur-3xl animate-float" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="glass-shell sticky top-4 z-20 mb-6 flex flex-col gap-4 rounded-3xl px-4 py-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <CircleDot className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              {eyebrow ? (
                <p className="font-mono text-[11px] tracking-[0.32em] text-primary uppercase">
                  {eyebrow}
                </p>
              ) : null}
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
              {description ? (
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {backHref ? (
              <Link
                href={backHref}
                transitionTypes={['nav-back']}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                <ArrowLeft className="size-4" />
                Trở lại
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => router.back()}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                <ArrowLeft className="size-4" />
                Trở lại
              </button>
            )}
            <Link
              href={homeHref}
              className={buttonVariants({ variant: 'secondary', size: 'sm' })}
            >
              <Home className="size-4" />
              Trang chủ
            </Link>
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
          </div>
        </header>

        <main className={cn('flex-1 pb-10', contentClassName)}>{children}</main>
      </div>
    </div>
  )
}
