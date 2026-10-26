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

export interface EventDayRecord {
  date: string
  surcharge: number
}

export interface EventDay extends EventDayRecord {
  label: string
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

export interface EventRecord {
  id: string
  type: EventType
  status: PublishStatus
  title: string
  round?: string
  organizerId: string
  venue: string
  hours: string
  description: string
  bookingOpens: string
  bookingCloses: string
  payment: PaymentAccount
  maxLotsPerSeller: number | null
  autoApprove: boolean
  days: EventDayRecord[]
  zones: Zone[]
  cols: number
  rows: number
  layout: CellType[]
  disabledCells: number[]
  lotSizes: Record<string, string>
}

export interface MarketEvent extends Omit<EventRecord, 'status' | 'days'> {
  status: EventStatus
  publishStatus: PublishStatus
  organizer: string
  days: EventDay[]
  lotState: Record<string, Exclude<LotState, 'free'>>[]
}

export type BookingStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface LotMove {
  from: string
  to: string
  at: string
}

export interface Booking {
  id: string
  eventId: string
  lot: string
  days: number[]
  shopId: string
  shopName: string
  category: string
  staff: string
  power: boolean
  note: string
  amount: number
  slipAmount: number
  slipName: string
  submittedAt: string
  status: BookingStatus
  reason?: string
  checkedIn?: boolean
  moves?: LotMove[]
  groupId?: string
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

export interface Organizer {
  id: string
  name: string
  contactName: string
  email: string
  phone?: string
  payment?: PaymentAccount
}

export interface ShopInfo {
  shopName: string
  category: string
  staff: string
  power: boolean
  note: string
}

export interface BookingDraft {
  eventId: string
  lots: string[]
  days: number[]
  shop?: ShopInfo
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
  passwordHash: string
  role: Role
  status: AccountStatus
  emailVerified: boolean
  statusReason?: string
  shopId?: string
  organizerId?: string
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
  | 'booking_approved'
  | 'booking_moved'
  | 'booking_rejected'
  | 'booking_cancelled'
  | 'organizer_pending'
  | 'organizer_approved'
  | 'organizer_rejected'
  | 'account_suspended'

export interface AppNotification {
  id: string
  accountId: string
  type: NotificationType
  message: string
  link?: string
  createdAt: string
  read: boolean
}
