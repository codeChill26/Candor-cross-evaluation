import 'server-only'

// Returns a generic message to the client while logging the real cause on the
// server. Raw Supabase/Postgres error strings can reveal table names, column
// names and constraint details — keep them out of client responses.
export function dbError(scope: string, error: { message: string }): { error: string } {
  console.error(`[action:${scope}]`, error.message)
  return { error: 'Đã có lỗi xảy ra. Vui lòng thử lại.' }
}
