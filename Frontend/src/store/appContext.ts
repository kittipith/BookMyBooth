import { createContext } from 'react'
import type {
  Account,
  AppNotification,
  Booking,
  BookingDraft,
  EventRecord,
  MarketEvent,
  Organizer,
  RegisterInput,
  Shop,
} from '../types'

export interface AppStoreState {
  /** งานพร้อมค่าที่คำนวณแล้ว (สถานะ ชื่อวัน สถานะล็อก) */
  events: MarketEvent[]
  bookings: Booking[]
  shops: Shop[]
  organizers: Organizer[]
  accounts: Account[]
  notifications: AppNotification[]
  draft: BookingDraft | null
}

export interface ActionResult {
  ok: boolean
  error?: string
}

export interface AppActions {
  setDraft: (draft: BookingDraft | null) => void
  /** ส่งคำขอจองจากร่างปัจจุบัน (ล็อกเป็น HELD ทันที) คืนหมายเลขการจอง หรือข้อผิดพลาด */
  submitBooking: (slipName: string, shopId: string) => { id?: string; error?: string }
  /** อนุมัติ หรือย้ายไปล็อกอื่นที่ว่างแล้วอนุมัติ */
  approveBooking: (id: string, moveTo?: string) => ActionResult
  rejectBooking: (id: string, reason: string) => void
  cancelBooking: (id: string, reason: string, by: 'seller' | 'organizer') => void
  updateShop: (shop: Shop) => void
  updateOrganizer: (organizer: Organizer) => void
  saveEvent: (event: EventRecord) => void
  /** สร้างบัญชีใหม่ (ยังไม่ยืนยันอีเมล) พร้อมร้านหรือองค์กรผู้จัด */
  createAccount: (input: RegisterInput) => Account
  verifyAccountEmail: (accountId: string) => void
  setAccountPassword: (accountId: string, passwordHash: string) => void
  /** ผู้ดูแลระบบอนุมัติหรือไม่อนุมัติบัญชีผู้จัดงาน */
  reviewOrganizer: (accountId: string, approve: boolean, reason?: string) => void
  /** ผู้ดูแลระบบระงับหรือยกเลิกการระงับบัญชี */
  setSuspended: (accountId: string, suspended: boolean, reason?: string) => void
  markNotificationsRead: (ids: string[]) => void
}

export type AppStore = AppStoreState & AppActions

export const AppContext = createContext<AppStore | null>(null)
