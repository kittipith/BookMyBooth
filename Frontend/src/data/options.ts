import {
  ArrowLeftRight,
  BadgeCheck,
  CircleCheck,
  CircleMinus,
  CircleX,
  Hourglass,
  Inbox,
  Receipt,
  ShieldBan,
  ShieldCheck,
  UserPlus,
  UserX,
  type LucideIcon,
} from 'lucide-react'
import type { AccountStatus, BookingUiStatus, EventStatus, EventType, LotState, NotificationType, Role } from '../types'

export const EVENT_TYPES: EventType[] = ['ตลาดนัด', 'งานแฟร์', 'งานมหาวิทยาลัย']

export const PRODUCT_CATEGORIES = ['อาหารและขนม', 'เครื่องดื่ม', 'เสื้อผ้า', 'งานทำมือ', 'หนังสือและของสะสม']

export const STAFF_OPTIONS = ['1 คน', '2 คน', '3 คนขึ้นไป']

export const POWER_OPTIONS = ['ไม่ใช้', '5A (พัดลม ไฟส่องสว่าง)', '15A (เครื่องใช้ไฟฟ้าความร้อน)']

export const BANKS = ['พร้อมเพย์', 'กสิกรไทย', 'ไทยพาณิชย์', 'กรุงเทพ', 'กรุงไทย', 'กรุงศรีอยุธยา', 'ทหารไทยธนชาต', 'ออมสิน']

export const REJECT_REASONS = ['ยอดในสลิปไม่ตรง', 'สลิปไม่ถูกต้อง', 'ประเภทสินค้าซ้ำในโซนเกินจำนวน', 'สินค้าไม่ตรงกับแนวงาน']

export const CANCEL_REASONS = ['ผู้ขายขอยกเลิกเอง', 'ล็อกถูกกันไว้ให้ผู้สนับสนุน', 'งานเปลี่ยนผังหรือย้ายสถานที่', 'ผู้ขายผิดกติกางาน']

export const ORGANIZER_REJECT_REASONS = ['ข้อมูลองค์กรไม่ครบ', 'ติดต่อผู้สมัครไม่ได้', 'ไม่ใช่หน่วยงานหรือชมรมในมหาวิทยาลัย']

export const SUSPEND_REASONS = ['ไม่มาตามนัดหลายครั้งโดยไม่แจ้งผู้จัดงาน', 'แนบสลิปปลอม', 'ทำผิดกติกาของระบบ']

export const BOOKING_STATUS_LABEL: Record<BookingUiStatus, string> = {
  awaiting_slip: 'รอแนบสลิป',
  expired: 'หมดเวลา',
  pending: 'รออนุมัติ',
  approved: 'อนุมัติแล้ว',
  rejected: 'ไม่อนุมัติ',
  cancelled: 'ยกเลิกแล้ว',
}

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  open: 'เปิดรับจอง',
  scheduled: 'รอเปิดรับจอง',
  closed: 'ปิดรับจองแล้ว',
  draft: 'ร่าง',
  ended: 'จบงานแล้ว',
}

/** ข้อความสถานะล็อกบนผังผู้ขาย */
export const LOT_STATE_LABEL: Record<LotState, string> = {
  free: 'ว่าง',
  pending: 'รออนุมัติ',
  booked: 'จองแล้ว',
  disabled: 'ปิดจอง',
}

/** ข้อความสถานะล็อกบนผังย่อของผู้จัดงาน */
export const FLOOR_STATE_LABEL: Record<LotState | 'target', string> = {
  target: 'ล็อกที่ร้านนี้ขอ',
  pending: 'คำขออื่นรออนุมัติ',
  booked: 'จองแล้ว',
  free: 'ว่าง',
  disabled: 'ปิดจอง',
}

export const CANCEL_REASON = {
  bySeller: 'ผู้ขายยกเลิกคำขอเอง',
}

export const ROLE_LABEL: Record<Role, string> = {
  seller: 'ผู้ขาย',
  organizer: 'ผู้จัดงาน',
  admin: 'ผู้ดูแลระบบ',
}

export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, string> = {
  active: 'ใช้งานได้',
  pending: 'รออนุมัติ',
  rejected: 'ไม่อนุมัติ',
  suspended: 'ถูกระงับ',
}

/** หน้าแรกของแต่ละบทบาทหลังเข้าสู่ระบบ */
export const ROLE_HOME: Record<Role, string> = {
  seller: '/',
  organizer: '/organizer',
  admin: '/admin',
}

/** ไอคอน SVG (lucide) และโทนสีของแจ้งเตือนแต่ละประเภท */
export const NOTIFICATION_ICON: Record<NotificationType, { icon: LucideIcon; tone: 'cobalt' | 'danger' | 'sun' | 'muted' }> = {
  booking_new: { icon: Inbox, tone: 'sun' },
  booking_slip_uploaded: { icon: Receipt, tone: 'sun' },
  booking_expired: { icon: Hourglass, tone: 'muted' },
  booking_approved: { icon: CircleCheck, tone: 'cobalt' },
  booking_moved: { icon: ArrowLeftRight, tone: 'cobalt' },
  booking_rejected: { icon: CircleX, tone: 'danger' },
  booking_cancelled: { icon: CircleMinus, tone: 'danger' },
  organizer_pending: { icon: UserPlus, tone: 'sun' },
  organizer_approved: { icon: BadgeCheck, tone: 'cobalt' },
  organizer_rejected: { icon: UserX, tone: 'danger' },
  account_suspended: { icon: ShieldBan, tone: 'danger' },
  account_unsuspended: { icon: ShieldCheck, tone: 'cobalt' },
}
