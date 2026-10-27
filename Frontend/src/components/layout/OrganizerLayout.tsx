import { ORGANIZER_NAV } from '../../data/content'
import { useOrganizerBookings } from '../../queries/organizer'
import DashboardLayout from './DashboardLayout'

export default function OrganizerLayout() {
  const { bookings } = useOrganizerBookings()
  const pending = bookings.filter((b) => b.status === 'pending').length
  return <DashboardLayout area="ผู้จัดงาน" home="/organizer" nav={ORGANIZER_NAV} badgeCount={pending} />
}
