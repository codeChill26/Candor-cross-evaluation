import { ImageResponse } from 'next/og'
import { siteName } from '@/lib/site'

// Branded preview card shown whenever a Candor link is shared (Zalo, Messenger,
// Slack, X…). The product spreads by people pasting links, so this matters.
export const alt = 'Candor — Công cụ đánh giá nội bộ ẩn danh cho team'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: '#0b0b0c',
          color: '#fafafa',
          padding: 80,
        }}
      >
        <div style={{ display: 'flex', fontSize: 26, letterSpacing: 10, color: '#8b8b93' }}>
          {siteName.toUpperCase()}
        </div>
        <div style={{ display: 'flex', fontSize: 66, fontWeight: 700, lineHeight: 1.15, marginTop: 28 }}>
          Đánh giá nội bộ ẩn danh cho team
        </div>
        <div style={{ display: 'flex', fontSize: 30, color: '#a1a1aa', marginTop: 30, maxWidth: 940 }}>
          Ẩn danh nằm trong cấu trúc dữ liệu — không ai, kể cả quản lý, biết ai viết gì.
        </div>
      </div>
    ),
    { ...size }
  )
}
