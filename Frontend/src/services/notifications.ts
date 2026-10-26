import type { Account, AppNotification, NotificationType } from '../types'

/** บัญชีที่ต้องได้รับแจ้งเตือน แยกตามเจ้าของร้าน ผู้จัดงาน หรือผู้ดูแลระบบ */
export const shopAccountIds = (accounts: Account[], shopId: string) =>
  accounts.filter((a) => a.shopId === shopId).map((a) => a.id)

export const organizerAccountIds = (accounts: Account[], organizerId: string) =>
  accounts.filter((a) => a.organizerId === organizerId).map((a) => a.id)

export const adminAccountIds = (accounts: Account[]) => accounts.filter((a) => a.role === 'admin').map((a) => a.id)

let seq = 0

/** สร้างการแจ้งเตือนเดียวกันให้หลายบัญชี */
export function buildNotices(
  accountIds: string[],
  type: NotificationType,
  message: string,
  createdAt: string,
  link?: string,
  read = false,
): AppNotification[] {
  return accountIds.map((accountId) => ({
    id: `n${Date.now().toString(36)}${(seq++).toString(36)}`,
    accountId,
    type,
    message,
    link,
    createdAt,
    read,
  }))
}
