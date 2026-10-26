import { ORGANIZER_NAV } from '../../data/content'
import { useOrganizerData } from '../../hooks/useAppStore'
import DashboardLayout from './DashboardLayout'

export default function OrganizerLayout() {
  const { myBookings } = useOrganizerData()
  const pending = myBookings.filter((b) => b.status === 'pending').length
  return <DashboardLayout area="ผู้จัดงาน" home="/organizer" nav={ORGANIZER_NAV} badgeCount={pending} />
}
