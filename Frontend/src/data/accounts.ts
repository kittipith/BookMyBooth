import type { Account } from '../types'

/**
 * บัญชีที่มีอยู่แล้วในระบบตั้งแต่เริ่ม เป็นเจ้าของร้านและงานในข้อมูลตัวอย่าง
 * บัญชีผู้ดูแลระบบสร้างโดยทีมพัฒนา (สมัครผ่านหน้าเว็บไม่ได้)
 * บัญชีใหม่มาจากการสมัครสมาชิก และเก็บรวมกับรายการนี้ใน state ของแอป
 */
export const SEED_ACCOUNTS: Account[] = [
  {
    id: 'a0', email: 'admin@bookmybooth.example', role: 'admin', status: 'active', emailVerified: true,
    displayName: 'ผู้ดูแลระบบ BookmyBooth', createdAt: '2024-10-01T09:00',
    passwordHash: '985ac8235fa51acbb11168e2f1b048891dfa71420b9ef301dc81a64a66ab4ac4',
  },
  {
    id: 'a1', email: 'padaeng@example.com', role: 'seller', status: 'active', emailVerified: true, shopId: 's1',
    createdAt: '2025-03-02T10:00', passwordHash: 'f84971692bb80307f8c3ba07d31d8c9e741f944381aaf1dc36474855fe6e4349',
  },
  {
    id: 'a2', email: 'grandma.tea@example.com', role: 'seller', status: 'active', emailVerified: true, shopId: 's9',
    createdAt: '2025-06-11T14:20', passwordHash: '9f87e3bf2b307143f165e6e79f23b6f8d0ceb9422250f394c6b6402c711a4ed2',
  },
  {
    id: 'a5', email: 'minimookata@example.com', role: 'seller', status: 'suspended', emailVerified: true, shopId: 's7',
    statusReason: 'ไม่มาตามนัดหลายครั้งโดยไม่แจ้งผู้จัดงาน', createdAt: '2025-04-18T11:05',
    passwordHash: '6890372203854a46415f3cc8ba076fcb6732bdb13a33e231e40272fba4ccad38',
  },
  {
    id: 'a3', email: 'malee@taladkeaw.example', role: 'organizer', status: 'active', emailVerified: true, organizerId: 'o1',
    createdAt: '2024-11-20T09:30', passwordHash: '1d5dbf9fd04b56817bf75d1f1d79ada2830831ae46eaa966a4c6e42c6d80c360',
  },
  {
    id: 'a4', email: 'contact@oldbooks.example', role: 'organizer', status: 'active', emailVerified: true, organizerId: 'o2',
    createdAt: '2025-01-08T16:45', passwordHash: '8b6c11b742ec7225d3703e364c69a5830c051c9ef3fc70b28cd19ca1664ae2d4',
  },
  {
    id: 'a6', email: 'music.club@example.com', role: 'organizer', status: 'pending', emailVerified: true, organizerId: 'o7',
    createdAt: '2026-10-23T20:15', passwordHash: '962d80b34efd347d5c8d8e4a3150848607687409a5d6b3ed534d6e115fca8d5c',
  },
]
