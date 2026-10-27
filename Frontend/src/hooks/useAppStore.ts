import { useContext } from 'react'
import { organizerFromMe, shopFromMe } from '../services/profileBridge'
import { shopStats } from '../services/selectors'
import { AppContext } from '../store/appContext'
import { AuthContext } from '../store/authContext'

export function useAppStore() {
  const store = useContext(AppContext)
  if (!store) throw new Error('useAppStore ต้องใช้ภายใน AppProvider')
  return store
}

export function useEvent(id: string | undefined) {
  return useAppStore().events.find((e) => e.id === id)
}

function useMe() {
  return useContext(AuthContext)?.me ?? null
}

/**
 * ร้านของผู้ขายที่เข้าสู่ระบบอยู่ (undefined ถ้ายังไม่เข้าสู่ระบบหรือไม่ใช่ผู้ขาย)
 * ยังไม่ถูกคัดลอกลงข้อมูลจำลอง (render แรกหลังล็อกอิน) ใช้ค่าจาก GET /me ไปก่อน
 */
export function useSessionShop() {
  const me = useMe()
  const { shops } = useAppStore()
  if (me?.role !== 'SELLER') return undefined
  return shops.find((s) => s.id === me.userId) ?? shopFromMe(me)
}

/** ร้าน การจอง และสถิติของผู้ขายที่เข้าสู่ระบบอยู่ ใช้ในหน้าที่ครอบด้วย RequireAuth role="seller" */
export function useMyShop() {
  const { bookings, events } = useAppStore()
  const shop = useSessionShop()
  if (!shop) throw new Error('ต้องเข้าสู่ระบบด้วยบัญชีผู้ขาย')
  const myBookings = bookings.filter((b) => b.shopId === shop.id)
  return { shop, myBookings, stats: shopStats(bookings, events, shop.id) }
}

/** ผู้จัดงานที่เข้าสู่ระบบอยู่ พร้อมงานและการจอง ใช้ในหน้าที่ครอบด้วย RequireAuth role="organizer" */
export function useOrganizerData() {
  const me = useMe()
  const { events, bookings, organizers } = useAppStore()
  const organizer = me?.role === 'ORGANIZER' ? (organizers.find((o) => o.id === me.userId) ?? organizerFromMe(me)) : undefined
  if (!organizer) throw new Error('ต้องเข้าสู่ระบบด้วยบัญชีผู้จัดงาน')
  const myEvents = events.filter((e) => e.organizerId === organizer.id)
  const ids = new Set(myEvents.map((e) => e.id))
  const myBookings = bookings.filter((b) => ids.has(b.eventId))
  return { organizer, myEvents, myBookings }
}
