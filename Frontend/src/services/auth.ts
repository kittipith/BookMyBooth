import type { UserDto } from '../api/dto'
import type { SignupProfile } from '../auth'
import { AUTH_RULES } from '../data/settings'
import type { Account, Organizer, RegisterErrors, RegisterInput, Shop } from '../types'
import { sha256 } from '../utils/sha256'

export const AUTH_ERROR = {
  missing: 'กรอกอีเมลและรหัสผ่าน',
  codeMissing: 'กรอกรหัสยืนยัน',
}

/** ตรงกับนโยบายรหัสผ่านของ User Pool (AWS-SETUP ข้อ 4.4) คืนข้อความผิดพลาด หรือ null */
export function passwordError(password: string) {
  const min = AUTH_RULES.minPasswordLength
  if (password.length < min || !/[a-z]/.test(password) || !/\d/.test(password)) {
    return `รหัสผ่านอย่างน้อย ${min} ตัว มีตัวพิมพ์เล็ก (a–z) และตัวเลข`
  }
  return null
}

export const PASSWORD_HINT = `อย่างน้อย ${AUTH_RULES.minPasswordLength} ตัว มีตัวพิมพ์เล็ก (a–z) และตัวเลข`

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^0\d{8,9}$/

export const normalizeEmail = (email: string) => email.trim().toLowerCase()

export const isEmail = (email: string) => EMAIL_PATTERN.test(email.trim())

/** ใส่อีเมลเป็น salt ให้รหัสผ่านเดียวกันของคนละบัญชีได้ hash ไม่ซ้ำกัน (ข้อมูลจำลองเดิม ลบในเฟส 8) */
export function hashPassword(email: string, password: string) {
  return sha256(`${normalizeEmail(email)}:${password}`)
}

/** ตรวจฟอร์มสมัครสมาชิก คืนข้อความผิดพลาดแยกตามช่อง (ว่าง = ผ่าน) อีเมลซ้ำ Cognito เป็นคนบอก */
export function validateRegistration(input: RegisterInput): RegisterErrors {
  const errors: RegisterErrors = {}
  const seller = input.role === 'seller'
  if (!input.orgName.trim()) errors.orgName = seller ? 'กรอกชื่อร้าน' : 'กรอกชื่อองค์กรหรือกลุ่มผู้จัด'
  if (!input.name.trim()) errors.name = seller ? 'กรอกชื่อเจ้าของร้าน' : 'กรอกชื่อผู้ติดต่อ'
  if (!PHONE_PATTERN.test(cleanPhone(input.phone))) errors.phone = 'เบอร์โทรขึ้นต้นด้วย 0 และมี 9–10 หลัก'
  if (seller && !input.category) errors.category = 'เลือกประเภทสินค้า'
  if (!isEmail(input.email)) errors.email = 'รูปแบบอีเมลไม่ถูกต้อง'

  const pwError = passwordError(input.password)
  if (pwError) errors.password = pwError
  if (input.confirmPassword !== input.password) errors.confirmPassword = 'รหัสผ่านทั้งสองช่องไม่ตรงกัน'
  return errors
}

export const cleanPhone = (phone: string) => phone.replace(/[\s-]/g, '')

/** ข้อมูลฟอร์มสมัครที่ส่งไปกับ confirmSignUp (F6) */
export function signupProfile(input: RegisterInput): SignupProfile {
  return {
    name: input.name.trim(),
    phone: cleanPhone(input.phone),
    orgName: input.orgName.trim(),
    category: input.role === 'seller' ? input.category : undefined,
  }
}

/** ชื่อที่แสดงของผู้ใช้ที่ล็อกอินอยู่: ผู้ขายแสดงชื่อเจ้าของและร้าน ผู้จัดงานแสดงชื่อผู้ติดต่อและองค์กร */
export function meProfile(me: UserDto) {
  const name = me.displayName || me.email
  if (me.role === 'SELLER') return { name, org: me.shopName ?? '' }
  if (me.role === 'ADMIN') return { name, org: 'ทีมดูแลระบบ' }
  return { name, org: me.orgName ?? '' }
}

/** ชื่อที่แสดงของบัญชีในข้อมูลจำลอง (หน้า Admin เดิม เปลี่ยนในเฟส 7) */
export function accountProfile(account: Account, shops: Shop[], organizers: Organizer[]) {
  if (account.role === 'seller') {
    const shop = shops.find((s) => s.id === account.shopId)
    return { name: shop?.owner ?? account.email, org: shop?.name ?? '' }
  }
  if (account.role === 'admin') return { name: account.displayName ?? account.email, org: 'ทีมดูแลระบบ' }
  const organizer = organizers.find((o) => o.id === account.organizerId)
  return { name: organizer?.contactName ?? account.email, org: organizer?.name ?? '' }
}
