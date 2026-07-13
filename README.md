# Candor

Nền tảng đánh giá chéo ẩn danh cho team. Xem `candor-project.md` cho spec đầy đủ (ý tưởng, kiến trúc, quyết định kỹ thuật).

## Setup

1. `npm install`
2. Tạo project Supabase và điền `.env.local` — xem `supabase/README.md` (bao gồm chạy `supabase/schema.sql` và các bước xác minh).
3. `npm run dev` → http://localhost:3000

## Scripts

- `npm run dev` — dev server
- `npm run build` — production build
- `npm run test` — chạy toàn bộ unit test (Vitest)
- `npm run lint` — ESLint

## Deploy

Xem `candor-project.md` → mục 3 "Hướng Dẫn Triển Khai" (Vercel + Supabase Cloud, biến môi trường cần thiết, cấu hình domain/HTTPS).

## Ghi chú kỹ thuật quan trọng

- Ẩn danh được đảm bảo ở tầng cấu trúc dữ liệu: bảng `responses` không có cột liên kết tới người đánh giá — xem `candor-project.md` → mục 2 "Key Technical Decisions".
- Dự án dùng Next.js 16 (`proxy.ts` thay `middleware.ts`), shadcn/ui bản Base UI (không phải Radix), zod v4 — các phiên bản này mới hơn dữ liệu huấn luyện thông thường, nên kiểm tra `node_modules/next/dist/docs/` và code thực tế trước khi giả định API.
- Giao diện hiện chỉ có tiếng Việt — song ngữ VN/EN bị cắt khỏi phạm vi theo đúng ưu tiên đã ghi trong `candor-project.md` → mục 1 "Roadmap & Milestones".
