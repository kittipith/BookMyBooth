import { useContext } from 'react'
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

function useAccount() {
  return useContext(AuthContext)?.account ?? null
}

/** ร้านของผู้ขายที่เข้าสู่ระบบอยู่ (undefined ถ้ายังไม่เข้าสู่ระบบหรือไม่ใช่ผู้ขาย) */
export function useSessionShop() {
  const account = useAccount()
  const { shops } = useAppStore()
  return account?.role === 'seller' ? shops.find((s) => s.id === account.shopId) : undefined
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
  const account = useAccount()
  const { events, bookings, organizers } = useAppStore()
  const organizer = account?.role === 'organizer' ? organizers.find((o) => o.id === account.organizerId) : undefined
  if (!organizer) throw new Error('ต้องเข้าสู่ระบบด้วยบัญชีผู้จัดงาน')
  const myEvents = events.filter((e) => e.organizerId === organizer.id)
  const ids = new Set(myEvents.map((e) => e.id))
  const myBookings = bookings.filter((b) => ids.has(b.eventId))
  return { organizer, myEvents, myBookings }
}
