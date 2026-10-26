import type { Zone } from '../types'

/** โซนตั้งต้นสำหรับงานใหม่และผังมาตรฐาน */
export const DEFAULT_ZONES: Zone[] = [
  { id: 'A', name: 'โซนอาหาร', size: '2×2 ม.', price: 350, amenities: ['ไฟฟ้า 5A', 'จุดล้างภาชนะ'] },
  { id: 'B', name: 'โซนทั่วไป', size: '2×2 ม.', price: 250, amenities: ['ไฟฟ้า 5A'] },
  { id: 'C', name: 'โซนหน้าทางเข้า', size: '2×2 ม.', price: 500, amenities: ['ไฟฟ้า 5A', 'ติดทางเข้า'] },
]

/** โซนที่เพิ่มใหม่ในตัววาดผัง */
export const NEW_ZONE: Omit<Zone, 'id'> = { name: 'โซนใหม่', size: '2×2 ม.', price: 200, amenities: ['ไฟฟ้า 5A'] }

/** รหัสโซนที่ใช้ได้ เพิ่มโซนได้สูงสุด 15 โซน */
export const ZONE_LETTERS = 'ABCDEFGHIJKLMNO'.split('')
