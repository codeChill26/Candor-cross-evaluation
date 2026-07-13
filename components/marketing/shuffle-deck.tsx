'use client'

import { useEffect, useState } from 'react'
import { shuffle } from '@/lib/utils/shuffle'

const SNIPPETS = [
  'Luôn đúng deadline, rất đáng tin.',
  'Nên chủ động chia sẻ tiến độ hơn.',
  'Code review kỹ, học được nhiều từ bạn.',
  'Đôi khi phản hồi hơi chậm trong nhóm chat.',
  'Rất giỏi gỡ rối khi team bị bí.',
]

type Card = { id: number; text: string }

export function ShuffleDeck() {
  const [cards, setCards] = useState<Card[]>(() => SNIPPETS.map((text, id) => ({ id, text })))

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const interval = setInterval(() => {
      setCards((prev) => shuffle(prev))
    }, 2200)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative h-[340px] w-full max-w-sm">
      {cards.map((card, index) => (
        <div
          key={card.id}
          className="absolute inset-x-0 rounded-xl border bg-card p-4 shadow-sm transition-all duration-700 ease-out"
          style={{
            transform: `translateY(${index * 56}px) scale(${1 - index * 0.03})`,
            zIndex: cards.length - index,
            opacity: 1 - index * 0.12,
          }}
        >
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted font-mono text-xs text-muted-foreground">
              ?
            </span>
            <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
              Ẩn danh
            </span>
          </div>
          <p className="mt-2 text-sm text-foreground">{card.text}</p>
        </div>
      ))}
    </div>
  )
}
