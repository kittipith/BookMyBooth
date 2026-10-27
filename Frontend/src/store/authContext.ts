import { createContext } from 'react'
import type { UserDto } from '../api/dto'
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

export interface LoginResult {
  error?: string
  /** บัญชียังไม่ยืนยันอีเมล ส่งรหัสไปที่อีเมลนี้แล้ว */
  verifyEmail?: string
  /** ชื่อที่ใช้ทักทายเมื่อเข้าสู่ระบบสำเร็จ */
  name?: string
}

export interface RegisterResult {
  errors?: RegisterErrors
  /** error ที่ไม่ใช่ของช่องใดช่องหนึ่ง */
  error?: string
  verifyEmail?: string
}

export interface VerifyResult {
  error?: string
  /** false = ยืนยันแล้วแต่ไม่มีรหัสผ่านในหน้านี้ (เช่น รีเฟรชหน้า) ต้องเข้าสู่ระบบเอง */
  signedIn?: boolean
  name?: string
}

export interface AuthStore {
  /** บัญชีที่เข้าสู่ระบบอยู่ (จาก GET /me) */
  account: Account | null
  /** โปรไฟล์เต็มจาก GET /me */
  me: UserDto | null
  /** dev = API จำลอง ไม่มีอีเมลจริง */
  authMode: 'dev' | 'cognito'
  /** คำขอเข้าสู่ระบบที่กำลังเปิดอยู่ (null = ปิด popup) */
  loginRequest: LoginRequest | null
  openLogin: (request?: LoginRequest) => void
  closeLogin: () => void
  login: (email: string, password: string) => Promise<LoginResult>
  /** สมัคร แล้วส่งรหัสยืนยันไปที่อีเมล */
  register: (input: RegisterInput) => Promise<RegisterResult>
  /** ส่งรหัสใหม่ (verify) หรือส่งรหัสตั้งรหัสผ่านใหม่ (reset) คืนข้อความผิดพลาด หรือ null */
  sendOtp: (email: string, purpose: OtpPurpose) => Promise<string | null>
  /** ยืนยันอีเมลด้วยรหัส แล้วเข้าสู่ระบบให้ถ้ายังจำรหัสผ่านไว้ */
  verifyEmail: (email: string, code: string) => Promise<VerifyResult>
  /** ตั้งรหัสผ่านใหม่ด้วยรหัสจากอีเมล คืนข้อความผิดพลาด หรือ null */
  resetPassword: (email: string, code: string, newPassword: string) => Promise<string | null>
  logout: () => Promise<void>
  /** ขอ token ใหม่และโหลดโปรไฟล์ใหม่ เช่น หลังผู้จัดงานได้รับอนุมัติ (F7) */
  refreshAccount: () => Promise<void>
  /** ทำ action ทันทีถ้าเข้าสู่ระบบด้วยบทบาทที่ต้องการแล้ว ไม่งั้นเปิด popup ก่อน */
  requireAuth: (role: Role, action: (account: Account) => void, message?: string) => void
}

export const AuthContext = createContext<AuthStore | null>(null)
