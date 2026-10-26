import { AUTH_RULES } from '../data/settings'
import type { Account, Organizer, RegisterErrors, RegisterInput, Shop } from '../types'
import { sha256 } from '../utils/sha256'

export const AUTH_ERROR = {
  missing: 'กรอกอีเมลและรหัสผ่าน',
  invalid: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
  otpInvalid: 'รหัสยืนยันไม่ถูกต้อง',
  otpExpired: 'รหัสยืนยันหมดอายุแล้ว กดส่งรหัสใหม่',
  suspended: (reason?: string) => `บัญชีนี้ถูกระงับ${reason ? `: ${reason}` : ''} ติดต่อผู้ดูแลระบบ`,
}

/** สุ่มรหัส OTP เป็นตัวเลขตามจำนวนหลักที่ตั้งไว้ */
export function generateOtp() {
  return Array.from(crypto.getRandomValues(new Uint8Array(AUTH_RULES.otpLength)), (n) => n % 10).join('')
}

/** ตรวจความยาวและส่วนประกอบของรหัสผ่าน คืนข้อความผิดพลาด หรือ null */
export function passwordError(password: string) {
  const min = AUTH_RULES.minPasswordLength
  if (password.length < min || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return `รหัสผ่านอย่างน้อย ${min} ตัว มีทั้งตัวอักษรและตัวเลข`
  }
  return null
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^0\d{8,9}$/

export const normalizeEmail = (email: string) => email.trim().toLowerCase()

/** ใส่อีเมลเป็น salt ให้รหัสผ่านเดียวกันของคนละบัญชีได้ hash ไม่ซ้ำกัน */
export function hashPassword(email: string, password: string) {
  return sha256(`${normalizeEmail(email)}:${password}`)
}

/** ตรวจอีเมลและรหัสผ่าน (จำลองฝั่งหน้าบ้าน) */
export function authenticate(accounts: Account[], email: string, password: string): { account?: Account; error?: string } {
  if (!email.trim() || !password) return { error: AUTH_ERROR.missing }
  const account = accounts.find((a) => a.email === normalizeEmail(email))
  if (!account || account.passwordHash !== hashPassword(email, password)) return { error: AUTH_ERROR.invalid }
  return { account }
}

/** ตรวจฟอร์มสมัครสมาชิก คืนข้อความผิดพลาดแยกตามช่อง (ว่าง = ผ่าน) */
export function validateRegistration(input: RegisterInput, accounts: Account[]): RegisterErrors {
  const errors: RegisterErrors = {}
  const seller = input.role === 'seller'
  if (!input.orgName.trim()) errors.orgName = seller ? 'กรอกชื่อร้าน' : 'กรอกชื่อองค์กรหรือกลุ่มผู้จัด'
  if (!input.name.trim()) errors.name = seller ? 'กรอกชื่อเจ้าของร้าน' : 'กรอกชื่อผู้ติดต่อ'
  if (!PHONE_PATTERN.test(input.phone.replace(/[\s-]/g, ''))) errors.phone = 'เบอร์โทรขึ้นต้นด้วย 0 และมี 9–10 หลัก'
  if (seller && !input.category) errors.category = 'เลือกประเภทสินค้า'

  if (!EMAIL_PATTERN.test(input.email.trim())) errors.email = 'รูปแบบอีเมลไม่ถูกต้อง'
  else if (accounts.some((a) => a.email === normalizeEmail(input.email))) errors.email = 'อีเมลนี้สมัครไว้แล้ว ลองเข้าสู่ระบบแทน'

  const pwError = passwordError(input.password)
  if (pwError) errors.password = pwError
  if (input.confirmPassword !== input.password) errors.confirmPassword = 'รหัสผ่านทั้งสองช่องไม่ตรงกัน'
  return errors
}

/** ชื่อที่แสดงของบัญชี: ผู้ขายแสดงชื่อเจ้าของและร้าน ผู้จัดงานแสดงชื่อผู้ติดต่อและองค์กร */
export function accountProfile(account: Account, shops: Shop[], organizers: Organizer[]) {
  if (account.role === 'seller') {
    const shop = shops.find((s) => s.id === account.shopId)
    return { name: shop?.owner ?? account.email, org: shop?.name ?? '' }
  }
  if (account.role === 'admin') return { name: account.displayName ?? account.email, org: 'ทีมดูแลระบบ' }
  const organizer = organizers.find((o) => o.id === account.organizerId)
  return { name: organizer?.contactName ?? account.email, org: organizer?.name ?? '' }
}
