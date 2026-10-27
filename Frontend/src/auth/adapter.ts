/**
 * ชั้นกลางของการล็อกอิน ให้ AuthProvider ใช้แบบเดียวกันทั้งสองโหมด (INTEGRATION-PLAN หัวข้อ 3.1)
 * dev = API จำลอง (/_dev/*) · cognito = Amplify + Cognito จริง เลือกด้วย VITE_AUTH_MODE
 */

export type SignupRole = 'seller' | 'organizer'

/** โปรไฟล์ที่ส่งไปกับ confirmSignUp (clientMetadata) ให้ PostConfirmation trigger สร้างบัญชี */
export interface SignupProfile {
  name: string
  phone: string
  /** ชื่อร้าน (ผู้ขาย) หรือชื่อองค์กร (ผู้จัดงาน) */
  orgName: string
  category?: string
}

export type SignInResult = 'done' | 'confirm_sign_up'

export interface AuthAdapter {
  /** dev ไม่มีอีเมลจริง กรอกรหัสอะไรก็ได้ */
  readonly mode: 'dev' | 'cognito'
  signUp(email: string, password: string, role: SignupRole): Promise<void>
  confirmSignUp(email: string, code: string, profile: SignupProfile): Promise<void>
  resendCode(email: string): Promise<void>
  /** confirm_sign_up = รหัสผ่านถูก แต่ยังไม่ยืนยันอีเมล */
  signIn(email: string, password: string): Promise<SignInResult>
  signOut(): Promise<void>
  forgotPassword(email: string): Promise<void>
  confirmForgotPassword(email: string, code: string, newPassword: string): Promise<void>
  /** null = ยังไม่ได้ล็อกอิน */
  getAccessToken(): Promise<string | null>
  /** ขอ token ใหม่ ให้ group ที่เพิ่งเปลี่ยน (เช่น ผู้จัดงานได้รับอนุมัติ) มีผล (F7) */
  refreshSession(): Promise<void>
}

/** error จาก Cognito (หรือ API จำลองที่ใช้ชื่อเดียวกัน) code = ชื่อ exception เช่น NotAuthorizedException */
export class AuthError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'AuthError'
    this.code = code
  }
}
