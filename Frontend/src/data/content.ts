/** ข้อความและเมนูที่แสดงบนหน้าเว็บ */
import type { Role } from '../types'
import { POLICY } from './settings'

interface NavItem {
  to: string
  label: string
  /** แสดงเฉพาะเมื่อเข้าสู่ระบบด้วยบทบาทนี้ */
  role?: Role
  badge?: boolean
  hideOnMobile?: boolean
}

export const SELLER_NAV: NavItem[] = [
  { to: '/events', label: 'หางานที่เปิดจอง' },
  { to: '/my-bookings', label: 'การจองของฉัน', role: 'seller', badge: true },
  { to: '/profile', label: 'ร้านของฉัน', role: 'seller', hideOnMobile: true },
]

/** ลิงก์ในเมนูบัญชีมุมขวาบน แยกตามบทบาท */
/** ข้อความใน popup เมื่อสมัครเป็นผู้จัดงาน */
export const ORGANIZER_SIGNUP_MESSAGE =
  'สมัครบัญชีผู้จัดงานเพื่อสร้างงานและวาดผังล็อก บัญชีผู้จัดงานแยกจากบัญชีผู้ขาย ผู้ดูแลระบบจะตรวจสอบก่อนเปิดใช้งาน'

export const ACCOUNT_MENU: Record<Role, { to: string; label: string }[]> = {
  seller: [
    { to: '/my-bookings', label: 'การจองของฉัน' },
    { to: '/profile', label: 'ร้านของฉัน' },
  ],
  organizer: [
    { to: '/organizer', label: 'หน้าผู้จัดงาน' },
    { to: '/organizer/bookings', label: 'การจองที่รออนุมัติ' },
    { to: '/organizer/profile', label: 'ข้อมูลผู้จัดงาน' },
  ],
  admin: [
    { to: '/admin', label: 'ผู้จัดงานรออนุมัติ' },
    { to: '/admin/users', label: 'ผู้ใช้ทั้งหมด' },
  ],
}

export interface SideNavItem {
  to: string
  label: string
  end?: boolean
  /** แสดงตัวเลขของรายการที่ต้องจัดการ */
  badge?: boolean
}

export const ORGANIZER_NAV: SideNavItem[] = [
  { to: '/organizer', label: 'ภาพรวม', end: true },
  { to: '/organizer/events', label: 'งานของฉัน' },
  { to: '/organizer/editor', label: 'สร้างและแก้ไขผัง' },
  { to: '/organizer/bookings', label: 'การจอง', badge: true },
  { to: '/organizer/vendors', label: 'ผู้ขาย' },
  { to: '/organizer/profile', label: 'ข้อมูลผู้จัดงาน' },
]

export const ADMIN_NAV: SideNavItem[] = [
  { to: '/admin', label: 'อนุมัติผู้จัดงาน', end: true, badge: true },
  { to: '/admin/users', label: 'ผู้ใช้ทั้งหมด' },
  { to: '/admin/events', label: 'งานทั้งหมด' },
]

export const HOW_IT_WORKS = [
  { title: 'เลือกงาน', text: 'ดูว่าแต่ละวันเหลือกี่ล็อก ราคาวันเสาร์อาทิตย์ต่างจากวันธรรมดาเท่าไร' },
  { title: 'เลือกล็อกบนผัง', text: 'เห็นตำแหน่งจริงเทียบกับทางเข้าและเวที เลือกได้หลายวันในล็อกเดียวกัน' },
  { title: 'แนบสลิป รออนุมัติ', text: `ผู้จัดงานตรวจภายใน ${POLICY.reviewHours} ชั่วโมง ได้ตั๋วพร้อม QR สำหรับเช็กอินหน้างาน` },
]

export const MAP_LEGEND = [
  { state: 'free', label: 'ว่าง' },
  { state: 'pending', label: 'รออนุมัติ' },
  { state: 'booked', label: 'จองแล้ว' },
  { state: 'disabled', label: 'ปิดจอง' },
  { state: 'sel', label: 'ที่คุณเลือก' },
]
