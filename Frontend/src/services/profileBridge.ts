/**
 * ชั่วคราว (เฟส 2–7) แปลงโปรไฟล์จาก GET /me เป็นร้าน/ผู้จัดงานของข้อมูลจำลองเดิม (id = userId)
 * ให้หน้าที่ยังไม่ได้สลับไปใช้ API ทำงานต่อได้ ลบในเฟส 8 พร้อม AppProvider
 */
import type { UserDto } from '../api/dto'
import { POWER_OPTIONS } from '../data/options'
import type { Organizer, Shop } from '../types'

export const shopFromMe = (me: UserDto): Shop => ({
  id: me.userId,
  name: me.shopName ?? '',
  category: me.category ?? '',
  owner: me.displayName ?? me.email,
  phone: me.phone ?? '',
  line: me.line ?? '',
  power: me.power ?? POWER_OPTIONS[0],
  bio: me.bio ?? '',
})

export const organizerFromMe = (me: UserDto): Organizer => ({
  id: me.userId,
  name: me.orgName ?? '',
  contactName: me.displayName ?? me.email,
  email: me.email,
  phone: me.phone,
  payment: me.payment,
})
