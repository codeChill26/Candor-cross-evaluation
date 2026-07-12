# Candor — Nền Tảng Đánh Giá Chéo Ẩn Danh Cho Team

> Tài liệu tổng hợp: ý tưởng & tính năng, kiến trúc kỹ thuật, và hướng dẫn triển khai — dùng để Claude (hoặc Claude Code) hiểu toàn bộ concept và build full dự án.

## Mục lục
1. [Kế Hoạch Dự Án](#1-kế-hoạch-dự-án)
2. [Kiến Trúc Kỹ Thuật](#2-kiến-trúc-kỹ-thuật)
3. [Hướng Dẫn Triển Khai](#3-hướng-dẫn-triển-khai)

---

## 1. Kế Hoạch Dự Án

> "Candor" là tên tạm đặt (nghĩa: sự thẳng thắn) — đổi tên tùy ý, không ảnh hưởng kiến trúc.

### Overview

Candor là một nền tảng web đa tổ chức (multi-tenant), nơi bất kỳ ai cũng có thể đăng ký, tạo một **team**, mời thành viên vào, rồi tạo các **vòng đánh giá chéo (round)** gồm bộ câu hỏi (rating / trắc nghiệm / tự luận). Mỗi thành viên trong team đánh giá tất cả thành viên còn lại (kể cả người tạo vòng đánh giá — không ai được miễn). Sau khi vòng đánh giá đóng, mỗi người nhận được báo cáo về chính mình — vừa dạng tổng hợp, vừa dạng từng bản riêng lẻ — nhưng **hoàn toàn ẩn danh**: không ai, kể cả người tạo vòng đánh giá hay chủ team, biết được ai đã viết gì.

Vấn đề nó giải quyết: các công cụ đánh giá 360° thông thường (Google Form, Typeform...) không đảm bảo ẩn danh thật sự — người tạo form luôn xem được ai trả lời gì. Candor thiết kế lại ở tầng dữ liệu để đảm bảo điều này không thể xảy ra, kể cả về mặt kỹ thuật.

### Target Users

- Các team nhỏ (startup, nhóm dự án sinh viên, nhóm làm việc nội bộ — ví dụ chính team SnapOn) muốn có phản hồi thẳng thắn giữa các thành viên mà không sợ va chạm quan hệ.
- Thành công = thành viên tin tưởng nộp phản hồi thật lòng (vì biết chắc không bị lộ danh tính), và nhận được phản hồi hữu ích để cải thiện.

### Design Direction

Giao diện cần đạt chuẩn "văn phòng" — chuyên nghiệp, gọn gàng, đáng tin cậy. Đây là tool xử lý phản hồi nhạy cảm giữa đồng nghiệp, không phải sản phẩm giải trí, nên giao diện phải toát ra sự nghiêm túc và an toàn ngay từ cái nhìn đầu.

- **Phong cách**: clean, minimal, corporate SaaS (tham khảo Notion, Linear, Slack) — không màu sắc lòe loẹt, không hiệu ứng "vui nhộn"/game hóa
- **Bảng màu**: nền trung tính (trắng/xám/đen), chỉ 1 màu nhấn (accent) duy nhất dùng nhất quán cho nút bấm/link/trạng thái quan trọng
- **Typography**: font sans-serif rõ ràng, phân cấp tiêu đề/nội dung rành mạch, đủ khoảng trắng để không rối mắt
- **Component**: dùng shadcn/ui làm nền nhưng tùy biến lại token màu/spacing theo bảng màu đã chọn — tránh trông như giao diện mặc định "AI tự sinh"
- **Trang báo cáo** (nơi quan trọng nhất) nên trình bày như một báo cáo thật — card rõ ràng, biểu đồ nhỏ cho điểm trung bình — không phải bảng dữ liệu thô
- Khi bước vào giai đoạn code UI thật, nên tham khảo kỹ hướng dẫn thiết kế frontend (design tokens, spacing, typography) để tránh giao diện rập khuôn, thiếu điểm nhấn

### Features

#### MVP (v1) — mục tiêu xong trước **Thứ 4, 15/07/2026**

- Đăng ký / đăng nhập: email + mật khẩu, và Google OAuth
- Tạo team (người tạo tự động là **owner**), mời thành viên qua **link mời** hoặc **mời trực tiếp qua email**
- Bất kỳ thành viên nào trong team có thể tạo một **vòng đánh giá** mới:
  - Đặt tên vòng, đặt **deadline**
  - Thêm câu hỏi: rating (thang điểm), trắc nghiệm (multiple choice), tự luận (text)
  - Toàn bộ thành viên team tại thời điểm tạo vòng tự động được đưa vào (ai cũng đánh giá — và bị đánh giá bởi — tất cả người còn lại, trừ bản thân)
- Thành viên vào vòng đang mở, đánh giá lần lượt từng người còn lại trong team (mỗi cặp reviewer→target chỉ nộp được 1 lần)
- Sau khi vòng **đóng** (tới deadline hoặc người tạo đóng thủ công), mỗi người xem được báo cáo về chính mình:
  - Bản tổng hợp: điểm trung bình theo câu hỏi rating, tỷ lệ chọn theo câu trắc nghiệm, toàn bộ comment tự luận gộp lại
  - Bản riêng lẻ: từng câu trả lời hiển thị như 1 thẻ độc lập, **ẩn danh, thứ tự xáo trộn ngẫu nhiên**
- Dashboard team: danh sách vòng đánh giá, trạng thái tiến độ (VD "4/6 đã nộp") — **không hiện ai đã nộp gì**, chỉ hiện số lượng
- Giao diện song ngữ Việt/Anh (toggle đơn giản)

#### Sau này / Ngoài phạm vi v1

- Tính năng AI: tự động tóm tắt/insight từ báo cáo mỗi người (đã có kế hoạch, cố tình để sau)
- Vòng đánh giá lặp lại tự động theo chu kỳ (VD hàng quý)
- Thư viện bộ câu hỏi mẫu dùng lại được (question set templates)
- Email nhắc nhở tự động khi gần tới deadline
- Xuất báo cáo ra PDF
- Vai trò/phân quyền chi tiết hơn trong team (VD: chỉ owner được tạo vòng)
- Gói trả phí / billing (Free/Pro) — v1 hoàn toàn miễn phí
- Loại trừ thủ công một số thành viên khỏi 1 vòng cụ thể (v1: mặc định toàn bộ team)
- Thống kê xu hướng qua nhiều vòng đánh giá theo thời gian

### Roadmap & Milestones

Do timeline cực gấp (~3 ngày), chia theo ngày thay vì theo "phase" truyền thống:

**Ngày 1 (Chủ nhật 12/07 – tối)**
- Setup project Next.js + Supabase, schema DB, RLS cơ bản
- Auth (email/pw + Google OAuth) hoạt động
- CRUD team + mời thành viên (link + email invite qua Supabase)

**Ngày 2 (Thứ 2 13/07)**
- Tạo vòng đánh giá + bộ câu hỏi (3 loại câu hỏi)
- Flow nộp đánh giá (structural anonymity — xem mục 2 → Key Technical Decisions)
- Logic đóng vòng (deadline hoặc thủ công)

**Ngày 3 (Thứ 3 14/07)**
- Trang báo cáo (tổng hợp + từng bản riêng, ẩn danh, xáo trộn thứ tự)
- Dashboard tiến độ, song ngữ VN/EN
- Deploy lên Vercel + Supabase Cloud, test end-to-end với team thật (vài chục user)
- Buffer để fix bug trước Thứ 4

> Rủi ro lớn nhất: 3 ngày là rất gấp cho một sản phẩm vừa yêu cầu bảo mật/ẩn danh nghiêm túc, vừa yêu cầu giao diện chuyên nghiệp. Nếu bắt đầu trễ hơn dự kiến, ưu tiên cắt: email invite tự động (chỉ giữ link mời), dashboard tiến độ chi tiết, song ngữ (giữ 1 ngôn ngữ trước) — **không cắt phần thiết kế ẩn danh, và không cắt chất lượng giao diện trang báo cáo/trang nộp đánh giá** (2 màn hình người dùng chạm vào nhiều nhất và quyết định độ tin cậy của sản phẩm).

### Timeline Estimate

- Tổng: ~3 ngày (rất gấp, gần như không có buffer)
- Nguồn rủi ro chính: Google OAuth setup (verification/consent screen đôi khi mất thời gian chờ), và logic ẩn danh cần test kỹ trước khi cho người thật dùng thử

### Cost Estimate

- Vercel: Free (Hobby plan) — đủ cho vài chục user
- Supabase: Free tier — đủ cho vài chục user, DB nhỏ
- Domain (tùy chọn): dùng subdomain `.vercel.app` miễn phí trước, mua domain riêng sau (~200.000–500.000 VNĐ/năm nếu cần)
- Email (Google OAuth + Supabase Auth invite): miễn phí trong giới hạn free tier
- **Tổng chi phí v1: ~0 VNĐ** (trừ khi mua domain riêng)

---

## 2. Kiến Trúc Kỹ Thuật

### Tech Stack

| Layer | Lựa chọn | Lý do |
|---|---|---|
| Frontend | Next.js 14+ (App Router) + TypeScript + Tailwind CSS | 1 codebase cho cả FE lẫn API routes, tốc độ dev nhanh nhất cho deadline gấp |
| UI components | shadcn/ui, tùy biến theo bảng màu trung tính + 1 màu nhấn | Form, table, dialog dựng sẵn giúp nhanh, nhưng phải chỉnh token màu/spacing để đạt phong cách "văn phòng" chuyên nghiệp (xem mục 1 → Design Direction), không giữ theme mặc định |
| Backend logic | Next.js Route Handlers / Server Actions | Không cần dựng backend riêng, giảm 1 tầng deploy/ops |
| Database + Auth | Supabase (Postgres + Auth + Row Level Security) | Auth email/password + Google OAuth có sẵn, Postgres mạnh cho ràng buộc unique/transaction cần cho anonymity |
| Data access | Supabase JS client trực tiếp (không thêm ORM) | Giảm 1 lớp trừu tượng để tiết kiệm thời gian setup |
| i18n (VN/EN) | Dictionary JSON tự viết (`dictionaries/vi.json`, `en.json`) + React Context | Nhẹ, nhanh hơn setup thư viện i18n đầy đủ; nâng cấp lên `next-intl` sau nếu cần |
| Hosting | Vercel (frontend + API) + Supabase Cloud (managed DB) | Gần như zero-ops, deploy bằng git push, khớp deadline 3 ngày |
| Invite email | Supabase Auth (admin invite-by-email) | Không cần tích hợp thêm dịch vụ email ngoài cho v1 |

### System Design

```
┌─────────────┐      HTTPS       ┌──────────────────────┐      Postgres wire      ┌─────────────┐
│   Browser   │ ───────────────▶ │  Next.js (Vercel)     │ ──────────────────────▶ │  Supabase    │
│  (Next.js   │ ◀─────────────── │  - Pages/Server Comp. │ ◀────────────────────── │  - Postgres  │
│   client)   │                  │  - Route Handlers/    │                          │  - Auth      │
└─────────────┘                  │    Server Actions     │                          │  - RLS       │
                                  └──────────────────────┘                          └─────────────┘
```

Không có server riêng cần quản lý — toàn bộ chạy trên hạ tầng serverless của Vercel + Supabase.

### Database Schema

**users** (quản lý bởi Supabase Auth, mở rộng bằng bảng `profiles`)
- `id` (uuid, = auth.users.id)
- `email`, `full_name`, `avatar_url`
- `created_at`

**teams**
- `id`, `name`, `slug`
- `created_by` (uuid → users.id)
- `created_at`

**team_members**
- `id`, `team_id`, `user_id`
- `role` (`owner` | `member`)
- `joined_at`
- unique (`team_id`, `user_id`)

**team_invites**
- `id`, `team_id`, `token` (dùng cho link mời)
- `email` (nullable — null nếu là link mời mở, có giá trị nếu mời đích danh)
- `created_by`, `expires_at`, `used_at`

**rounds** (1 vòng đánh giá)
- `id`, `team_id`, `title`
- `created_by`, `deadline`
- `status` (`draft` | `open` | `closed`)
- `created_at`

**round_questions**
- `id`, `round_id`
- `type` (`rating` | `multiple_choice` | `text`)
- `prompt`
- `options_json` (cho multiple_choice: mảng lựa chọn)
- `min_value`, `max_value` (cho rating)
- `order_index`

**round_participants** (snapshot thành viên tại thời điểm tạo vòng)
- `id`, `round_id`, `user_id`

**submission_status** (chỉ theo dõi TIẾN ĐỘ, không chứa nội dung)
- `id`, `round_id`, `reviewer_id`, `target_id`
- `submitted_at`
- unique (`round_id`, `reviewer_id`, `target_id`)

**responses** (nội dung câu trả lời — **KHÔNG có cột `reviewer_id`**)
- `id`, `round_id`, `target_id`
- `answers_json` (mảng {question_id, value})
- `submitted_at`

> Đây là điểm mấu chốt của toàn bộ hệ thống — xem "Key Technical Decisions" bên dưới.

### API Design

**Auth** — xử lý qua Supabase Auth client (không cần route riêng)

**Teams**
- `POST /api/teams` — tạo team mới (user thành owner)
- `POST /api/teams/:id/invites` — tạo link mời hoặc gửi email mời
- `POST /api/teams/join/:token` — chấp nhận lời mời, join team
- `GET /api/teams/:id/members` — danh sách thành viên

**Rounds**
- `POST /api/teams/:id/rounds` — tạo vòng đánh giá (kèm câu hỏi)
- `GET /api/teams/:id/rounds` — danh sách vòng của team
- `GET /api/rounds/:id` — chi tiết 1 vòng + tiến độ (số lượng, không danh tính)
- `POST /api/rounds/:id/close` — đóng vòng thủ công (chỉ người tạo)

**Submissions**
- `POST /api/rounds/:id/targets/:targetId/responses` — nộp đánh giá cho 1 người trong vòng (insert đồng thời vào `submission_status` và `responses`, KHÔNG liên kết 2 bảng bằng reviewer_id)
- `GET /api/rounds/:id/my-progress` — xem mình đã đánh giá xong những ai chưa (chỉ dùng `submission_status`)

**Reports**
- `GET /api/rounds/:id/report/me` — báo cáo về bản thân (chỉ khả dụng khi `status = closed`): trả về bản tổng hợp + danh sách response riêng lẻ (thứ tự xáo trộn ngẫu nhiên mỗi lần gọi)

### Key Technical Decisions

**1. Ẩn danh ở tầng cấu trúc dữ liệu, không chỉ ở tầng policy/giao diện.**
Bảng `responses` (chứa nội dung câu trả lời) hoàn toàn không có cột liên kết tới người đánh giá. Việc theo dõi "ai đã nộp/chưa nộp" nằm ở bảng `submission_status` riêng biệt, chỉ chứa boolean/timestamp, không chứa nội dung. Nhờ vậy, kể cả service role / superuser của Supabase truy vấn trực tiếp DB cũng không thể join 2 bảng này để suy ra ai viết gì — vì không có cột chung nào để join. Đây là thiết kế mạnh hơn nhiều so với chỉ dùng Row Level Security để "ẩn" cột reviewer_id, vì RLS chỉ ẩn ở tầng truy vấn ứng dụng, dữ liệu gốc vẫn tồn tại và có thể bị truy cập bởi ai có quyền admin.

**2. Báo cáo chỉ hiển thị sau khi vòng đánh giá đóng.**
Nếu cho xem báo cáo ngay khi có người nộp (trong lúc vòng còn mở), với team nhỏ (VD chỉ 3-4 người), người nhận có thể suy luận danh tính qua loại trừ (biết ai chưa nộp → phần còn lại chắc chắn là của người đã nộp). Khóa hiển thị báo cáo cho tới khi vòng đóng giúp giảm rủi ro này.

**3. Thứ tự các response riêng lẻ được xáo trộn ngẫu nhiên mỗi lần render**, không theo thứ tự nộp — tránh lộ danh tính qua "người này luôn nộp đầu tiên".

**4. Giới hạn tự nhiên của việc ẩn danh với team rất nhỏ.**
Với team chỉ 2-3 người, ẩn danh gần như không có ý nghĩa thực tế (dễ đoán qua văn phong hoặc loại trừ, bất kể thiết kế kỹ thuật tốt đến đâu). Nên cân nhắc cảnh báo trong UI khi team quá nhỏ (VD dưới 4 người) — có thể để v2, nhưng đáng ghi chú ngay từ v1.

**5. Không dùng ORM riêng, gọi thẳng Supabase client** — giảm 1 lớp trừu tượng, phù hợp deadline 3 ngày. Có thể refactor sang Drizzle/Prisma sau nếu dự án lớn lên.

**6. Vai trò trong team chỉ có `owner`/`member`, mọi member đều tạo được vòng đánh giá** (theo đúng yêu cầu ban đầu: "một người trong team tạo bộ câu hỏi" không nhất thiết là chủ team). `owner` chỉ có thêm quyền quản lý thành viên (xóa/rời team).

---

## 3. Hướng Dẫn Triển Khai

### Target Environment

- **Frontend + API**: Vercel (Hobby/free plan) — phù hợp vì Next.js là first-class citizen trên Vercel, deploy bằng git push, không cần quản lý server
- **Database + Auth**: Supabase Cloud (Free tier) — đủ cho vài chục user ban đầu, có thể nâng cấp plan sau mà không cần đổi kiến trúc

Quy mô vài chục user test nội bộ hoàn toàn nằm trong free tier của cả hai dịch vụ — không tốn chi phí ở giai đoạn này.

### Prerequisites

- Tài khoản GitHub (chứa source code)
- Tài khoản Vercel (đăng nhập bằng GitHub)
- Tài khoản Supabase (tạo project mới)
- Google Cloud Console project (để lấy OAuth Client ID/Secret cho đăng nhập Google) — cần cấu hình `Authorized redirect URI` trỏ về Supabase Auth callback URL
- (Tùy chọn) Tên miền riêng nếu không muốn dùng subdomain `.vercel.app`

### Server Setup

Không có server truyền thống cần provision — cả Vercel và Supabase đều serverless/managed. Các bước "setup" thực chất là cấu hình:

1. Tạo project mới trên Supabase → lấy `Project URL` và `anon public key` (dùng ở client) + `service_role key` (dùng ở server-side, giữ bí mật tuyệt đối, không expose ra client)
2. Trong Supabase Dashboard → Authentication → bật Email provider + Google provider, nhập Client ID/Secret từ Google Cloud Console
3. Chạy schema SQL (từ mục 2 → Database Schema) trong Supabase SQL Editor để tạo các bảng: `profiles`, `teams`, `team_members`, `team_invites`, `rounds`, `round_questions`, `round_participants`, `submission_status`, `responses`
4. Bật Row Level Security (RLS) trên tất cả bảng, viết policy sao cho:
   - User chỉ đọc/ghi được dữ liệu của team mình thuộc về
   - Bảng `responses` **không cho phép SELECT trực tiếp bởi client** với điều kiện lọc theo `reviewer` (vì cột này không tồn tại) — chỉ cho phép đọc qua route đã kiểm tra `round.status = closed`

### Deploying the App

1. Push code lên GitHub repository
2. Trên Vercel: "Import Project" → chọn repo → Vercel tự nhận diện Next.js, không cần config build thêm
3. Thêm biến môi trường trong Vercel Project Settings → Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (chỉ dùng trong server-side code, không public)
4. Deploy — Vercel build và cấp domain dạng `ten-du-an.vercel.app` ngay lập tức
5. Test lại toàn bộ flow auth (email + Google) trên domain thật, vì OAuth redirect URI cần khớp chính xác domain deploy

### Domain & HTTPS

- Vercel tự cấp HTTPS miễn phí cho domain `.vercel.app` — không cần làm gì thêm
- Nếu dùng domain riêng: thêm domain trong Vercel Project Settings → Domains, trỏ DNS (A record hoặc CNAME theo hướng dẫn Vercel hiển thị) → Vercel tự động cấp SSL (Let's Encrypt) sau khi DNS verify xong (thường vài phút tới vài giờ)
- Nhớ cập nhật lại `Authorized redirect URI` trong Google Cloud Console và Supabase Auth settings nếu đổi sang domain riêng

### CI/CD

Vercel tự động deploy mỗi khi push lên nhánh `main` (production) hoặc tạo preview deployment cho mỗi pull request/branch khác — không cần setup GitHub Actions riêng cho quy mô dự án này. Đủ dùng cho solo dev + deadline gấp.

### Monitoring & Maintenance

- **Logs**: Vercel Dashboard → Deployments → Runtime Logs (xem lỗi API routes)
- **DB health**: Supabase Dashboard có sẵn biểu đồ usage (rows, storage, auth users) để theo dõi khi nào cần nâng free tier
- **Backup**: Supabase free tier có backup tự động hàng ngày (point-in-time recovery không có ở free tier — nếu dữ liệu quan trọng, cân nhắc nâng Pro plan sau khi có user thật)
- **Cảnh báo cần theo dõi riêng**: vì tính năng cốt lõi là ẩn danh, nên định kỳ kiểm tra lại RLS policies và đảm bảo không có route/debug endpoint nào vô tình expose `service_role key` hoặc join `responses` với `submission_status` theo reviewer

