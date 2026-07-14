export type InviteEmailInput = {
  teamName: string
  inviterName: string
  joinUrl: string
}

export function buildInviteEmailSubject({ teamName }: InviteEmailInput): string {
  return `Bạn được mời tham gia team ${teamName} trên Candor`
}

export function buildInviteEmailHtml({ teamName, inviterName, joinUrl }: InviteEmailInput): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #111;">Bạn được mời tham gia team ${escapeHtml(teamName)}</h2>
      <p>${escapeHtml(inviterName)} đã mời bạn tham gia team <strong>${escapeHtml(teamName)}</strong> trên Candor — nền tảng đánh giá chéo ẩn danh cho team.</p>
      <p>
        <a href="${joinUrl}" style="display: inline-block; padding: 10px 20px; background: #111; color: #fff; text-decoration: none; border-radius: 6px;">
          Tham gia team
        </a>
      </p>
      <p style="color: #666; font-size: 13px;">Link này hết hạn sau 7 ngày. Nếu bạn không mong đợi email này, có thể bỏ qua.</p>
    </div>
  `.trim()
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
