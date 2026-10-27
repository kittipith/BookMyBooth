export type EventType = 'ตลาดนัด' | 'งานแฟร์' | 'งานมหาวิทยาลัย'
/** สถานะที่ผู้จัดงานตั้งเอง */
export type PublishStatus = 'draft' | 'open' | 'closed'
/**
 * สถานะที่แสดงผลจริง คำนวณจากสถานะที่ตั้ง วันงาน และช่วงเปิด–ปิดรับจอง
 * scheduled = เผยแพร่แล้วแต่ยังไม่ถึงวันเปิดรับจอง
 */
export type EventStatus = PublishStatus | 'scheduled' | 'ended'
/** free = AVAILABLE, pending = HELD, booked = BOOKED, disabled = DISABLED */
export type LotState = 'free' | 'pending' | 'booked' | 'disabled'

/** ช่องในตัววาดผัง: ว่าง, ทางเดิน, เวที, ทางเข้า หรือรหัสโซน (A, B, C, ...) */
export type CellType = string

export interface Zone {
  id: string
  name: string
  size: string
  price: number
  amenities: string[]
}

export interface Lot {
  code: string
  zone: string
}

export interface PaymentAccount {
  bank: string
  accountName: string
  accountNo: string
}

/**
 * งานจาก API (GET /events, /events/{id}) จองทั้งงาน ราคาต่อล็อก = ราคาโซน ไม่มีราคารายวัน (F11, I2)
 * หน้ารายการงาน (GET /events) ไม่มีผังและบัญชีรับเงิน layout จึงเป็น [] จนกว่าจะโหลดรายละเอียด
 */
export interface PublicEvent {
  id: string
  type: EventType
  title: string
  round?: string
  organizerId: string
  /** ชื่อองค์กรผู้จัดตอนสร้างงาน */
  organizer: string
  venue: string
  hours: string
  description: string
  /** YYYY-MM-DD */
  startDate: string
  endDate: string
  /** ISO-8601 */
  bookingOpensAt: string
  bookingClosesAt: string
  /** คำนวณโดย backend */
  status: EventStatus
  /** สถานะที่ผู้จัดงานตั้ง (draft → open → closed) */
  publishStatus: PublishStatus
  maxLotsPerSeller: number | null
  slipDeadlineMinutes: number
  zones: Zone[]
  cols: number
  rows: number
  layout: CellType[]
  disabledCells: number[]
  lotSizes: Record<string, string>
  payment?: PaymentAccount
}

/** สถานะล็อกทั้งงานจาก GET /events/{id}/lots ตามรหัสล็อก */
export type LotStates = Record<string, LotState>

export type BookingStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

/**
 * สถานะการจองจาก API เพิ่มจากเดิม 2 ค่า: รอแนบสลิป (PENDING_PAYMENT) และหมดเวลา (EXPIRED) (F21)
 * pending = แนบสลิปแล้ว รอผู้จัดงานตรวจ (PENDING_REVIEW)
 */
export type BookingUiStatus = BookingStatus | 'awaiting_slip' | 'expired'

/** การจองหนึ่งล็อกจาก GET /bookings/me จองหลายล็อกพร้อมกันผูกด้วย groupId (สลิปเดียวต่อชุด) */
export interface SellerBooking {
  id: string
  groupId: string
  eventId: string
  eventTitle: string
  lot: string
  status: BookingUiStatus
  /** ราคาโซน (บาท) */
  amount: number
  /** เส้นตายแนบสลิป (ISO) */
  expiresAt: string
  hasSlip: boolean
  shopName: string
  category: string
  staff: string
  power: boolean
  note: string
  reason?: string
  moves: LotMove[]
  checkedIn: boolean
  createdAt: string
}

/** การจองในงานของผู้จัดงาน (GET /events/{id}/bookings) มีข้อมูลที่ผู้จัดงานต้องใช้ตรวจเพิ่ม */
export interface OrganizerBooking extends SellerBooking {
  sellerId: string
  productDescription: string
  checkedInAt?: string
}

export interface LotMove {
  from: string
  to: string
  at: string
}

export interface Shop {
  id: string
  name: string
  category: string
  owner: string
  phone: string
  line: string
  power: string
  bio: string
}

export interface ShopInfo {
  shopName: string
  category: string
  staff: string
  power: boolean
  note: string
}

export interface ShopStats {
  approved: number
  total: number
  showRate: number | null
  pastCount: number
}

export interface VendorStat extends ShopStats {
  shop: Shop
  flagged: boolean
}

export type Role = 'seller' | 'organizer' | 'admin'
/** pending = ผู้จัดงานรอผู้ดูแลระบบอนุมัติ, rejected = ไม่อนุมัติ, suspended = ถูกระงับ */
export type AccountStatus = 'active' | 'pending' | 'rejected' | 'suspended'

export interface Account {
  id: string
  email: string
  role: Role
  status: AccountStatus
  statusReason?: string
  displayName?: string
  createdAt: string
}

export interface RegisterInput {
  role: Exclude<Role, 'admin'>
  orgName: string
  name: string
  phone: string
  category: string
  email: string
  password: string
  confirmPassword: string
}

export type RegisterErrors = Partial<Record<keyof RegisterInput, string>>

export type NotificationType =
  | 'booking_new'
  | 'booking_slip_uploaded'
  | 'booking_expired'
  | 'booking_approved'
  | 'booking_moved'
  | 'booking_rejected'
  | 'booking_cancelled'
  | 'organizer_pending'
  | 'organizer_approved'
  | 'organizer_rejected'
  | 'account_suspended'
  | 'account_unsuspended'

export interface AppNotification {
  id: string
  accountId: string
  type: NotificationType
  message: string
  link?: string
  createdAt: string
  read: boolean
}
