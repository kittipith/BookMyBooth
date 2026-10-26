import { createContext } from 'react'
import type { Account, RegisterErrors, RegisterInput, Role } from '../types'

export type AuthMode = 'login' | 'register' | 'forgot'
export type OtpPurpose = 'verify' | 'reset'

export interface LoginRequest {
  /** เปิด popup ที่แท็บไหน (ค่าเริ่มต้น login) */
  mode?: AuthMode
  /** บังคับบทบาทของบัญชีที่ใช้เข้าสู่ระบบหรือสมัคร */
  role?: Role
  /** ข้อความอธิบายว่าทำไมต้องเข้าสู่ระบบ */
  message?: string
  /** ทำต่อหลังเข้าสู่ระบบหรือสมัครสำเร็จ */
  onSuccess?: (account: Account) => void
}

export interface OtpTicket {
  code: string
  /** เวลาหมดอายุ (ms) */
  expiresAt: number
}

export interface LoginResult {
  error?: string
  /** บัญชียังไม่ยืนยันอีเมล ระบบส่งรหัสไปที่อีเมลนี้แล้ว */
  verifyEmail?: string
}

export interface AuthStore {
  /** บัญชีที่เข้าสู่ระบบอยู่ (บัญชีที่ถูกระงับจะหลุดจากระบบ) */
  account: Account | null
  /** คำขอเข้าสู่ระบบที่กำลังเปิดอยู่ (null = ปิด popup) */
  loginRequest: LoginRequest | null
  openLogin: (request?: LoginRequest) => void
  closeLogin: () => void
  login: (email: string, password: string) => LoginResult
  /** สมัคร แล้วส่งรหัสยืนยันไปที่อีเมล */
  register: (input: RegisterInput) => { errors?: RegisterErrors; verifyEmail?: string }
  /** ส่งรหัส OTP (ใหม่) ไปที่อีเมล */
  sendOtp: (email: string, purpose: OtpPurpose) => void
  /** รหัสล่าสุดที่ส่งไป ใช้แสดงบนจอในโหมดทดลองที่ยังไม่มีระบบส่งอีเมล */
  lastOtp: (email: string, purpose: OtpPurpose) => OtpTicket | undefined
  /** ยืนยันอีเมลด้วย OTP แล้วเข้าสู่ระบบ คืนข้อความผิดพลาด หรือ null */
  verifyEmail: (email: string, code: string) => string | null
  /** ตั้งรหัสผ่านใหม่ด้วย OTP คืนข้อความผิดพลาด หรือ null */
  resetPassword: (email: string, code: string, newPassword: string) => string | null
  logout: () => void
  /** ทำ action ทันทีถ้าเข้าสู่ระบบด้วยบทบาทที่ต้องการแล้ว ไม่งั้นเปิด popup ก่อน */
  requireAuth: (role: Role, action: (account: Account) => void, message?: string) => void
}

export const AuthContext = createContext<AuthStore | null>(null)
