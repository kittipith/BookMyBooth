import { setTokenProvider } from '../api/client'
import { config } from '../config'
import { AuthError, type AuthAdapter } from './adapter'
import { cognitoAdapter } from './cognitoAdapter'
import { devAdapter } from './devAdapter'

export * from './adapter'

export const authAdapter: AuthAdapter = config.authMode === 'cognito' ? cognitoAdapter : devAdapter

setTokenProvider(() => authAdapter.getAccessToken())

/** ข้อความภาษาไทยของ error จาก Cognito ที่ผู้ใช้เจอบ่อย */
const MESSAGES: Record<string, string> = {
  NotAuthorizedException: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
  UserNotFoundException: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
  UsernameExistsException: 'อีเมลนี้สมัครไว้แล้ว ลองเข้าสู่ระบบแทน',
  UserNotConfirmedException: 'ยังไม่ได้ยืนยันอีเมล',
  CodeMismatchException: 'รหัสยืนยันไม่ถูกต้อง',
  ExpiredCodeException: 'รหัสยืนยันหมดอายุแล้ว กดส่งรหัสใหม่',
  InvalidPasswordException: 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัว มีตัวพิมพ์เล็กและตัวเลข',
  LimitExceededException: 'ลองหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่',
  TooManyRequestsException: 'ลองหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่',
  CodeDeliveryFailureException: 'ส่งอีเมลไม่สำเร็จ กรุณาลองใหม่ภายหลัง',
}

export const SUSPENDED_MESSAGE = 'บัญชีนี้ถูกระงับ ติดต่อผู้ดูแลระบบ'

export function isSuspendedError(error: unknown) {
  return error instanceof AuthError && error.code === 'NotAuthorizedException' && /disabled/i.test(error.message)
}

export function authErrorMessage(error: unknown): string {
  if (isSuspendedError(error)) return SUSPENDED_MESSAGE
  if (error instanceof AuthError) return MESSAGES[error.code] ?? error.message
  if (error instanceof Error && error.message) return error.message
  return 'เกิดข้อผิดพลาด กรุณาลองใหม่'
}
