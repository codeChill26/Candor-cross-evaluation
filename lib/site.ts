// Single source of truth for site-level SEO metadata, shared by the root
// layout, robots.ts, sitemap.ts and the OG image.
//
// Set NEXT_PUBLIC_SITE_URL to the real domain when deploying (e.g. on Vercel).
// Canonical URLs, the sitemap and OG image links are all derived from it.
export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export const siteName = 'Candor'

export const siteTitle = 'Candor — Công cụ đánh giá nội bộ ẩn danh cho team'

export const siteDescription =
  'Công cụ đánh giá nội bộ 360° ẩn danh cho team nhỏ. Ẩn danh nằm ngay trong cấu trúc dữ liệu — không ai, kể cả quản lý, biết ai viết gì. Dùng thử miễn phí, không cần tài khoản.'

// Head term "đánh giá nội bộ" plus qualifiers that separate us from the ISO
// "đánh giá nội bộ" (internal audit) crowd, which is a different audience.
export const siteKeywords = [
  'đánh giá nội bộ',
  'công cụ đánh giá nội bộ',
  'đánh giá nội bộ nhân sự',
  'phần mềm đánh giá nội bộ',
  'đánh giá nội bộ ẩn danh',
  'đánh giá chéo nội bộ',
  'đánh giá 360 độ',
  'đánh giá đồng nghiệp ẩn danh',
  'phản hồi ẩn danh cho team',
]
