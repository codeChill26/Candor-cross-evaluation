import { FirebaseError } from 'firebase/app'

export function getGoogleSignInErrorMessage(error: unknown): string | null {
  if (error instanceof FirebaseError) {
    if (error.code === 'auth/popup-closed-by-user') {
      return null
    }
    if (error.code === 'auth/popup-blocked') {
      return 'Trình duyệt đã chặn popup, vui lòng cho phép popup để đăng nhập bằng Google.'
    }
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Đăng nhập Google thất bại.'
}
