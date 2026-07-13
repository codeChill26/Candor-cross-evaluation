import { describe, it, expect } from 'vitest'
import { FirebaseError } from 'firebase/app'
import { getGoogleSignInErrorMessage } from '@/lib/firebase/google-error'

describe('getGoogleSignInErrorMessage', () => {
  it('returns null when the user closes the popup themselves', () => {
    const error = new FirebaseError('auth/popup-closed-by-user', 'Popup closed by user')
    expect(getGoogleSignInErrorMessage(error)).toBeNull()
  })

  it('returns a Vietnamese message when the popup is blocked', () => {
    const error = new FirebaseError('auth/popup-blocked', 'Popup blocked')
    expect(getGoogleSignInErrorMessage(error)).toBe(
      'Trình duyệt đã chặn popup, vui lòng cho phép popup để đăng nhập bằng Google.'
    )
  })

  it('falls back to the message of any other Error (e.g. a Supabase AuthError)', () => {
    expect(getGoogleSignInErrorMessage(new Error('invalid client id'))).toBe('invalid client id')
  })

  it('falls back to a generic Vietnamese message for non-Error values', () => {
    expect(getGoogleSignInErrorMessage('not an error')).toBe('Đăng nhập Google thất bại.')
  })
})
