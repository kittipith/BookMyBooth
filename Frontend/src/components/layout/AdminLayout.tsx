import { ADMIN_NAV } from '../../data/content'
import { useAppStore } from '../../hooks/useAppStore'
import DashboardLayout from './DashboardLayout'

export default function AdminLayout() {
  const { accounts } = useAppStore()
  // ผู้จัดงานที่ยืนยันอีเมลแล้วและรออนุมัติ
  const pending = accounts.filter((a) => a.role === 'organizer' && a.status === 'pending' && a.emailVerified).length
  return <DashboardLayout area="ผู้ดูแลระบบ" home="/admin" nav={ADMIN_NAV} badgeCount={pending} />
}
