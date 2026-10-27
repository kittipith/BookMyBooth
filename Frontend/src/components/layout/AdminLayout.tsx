import { ADMIN_NAV } from '../../data/content'
import { useAdminUsers } from '../../queries/admin'
import DashboardLayout from './DashboardLayout'

export default function AdminLayout() {
  const { data: users = [] } = useAdminUsers()
  // ผู้สมัครผู้จัดงานที่รออนุมัติ (มีในตารางผู้ใช้ได้หลังยืนยันอีเมลแล้วเท่านั้น)
  const pending = users.filter((u) => u.role === 'ORGANIZER' && u.status === 'PENDING').length
  return <DashboardLayout area="ผู้ดูแลระบบ" home="/admin" nav={ADMIN_NAV} badgeCount={pending} />
}
