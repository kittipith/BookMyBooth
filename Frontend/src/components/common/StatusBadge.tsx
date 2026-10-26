import type { AccountStatus, BookingStatus, EventStatus } from '../../types'
import { ACCOUNT_STATUS_LABEL, BOOKING_STATUS_LABEL, EVENT_STATUS_LABEL } from '../../data/options'

const base = 'inline-block whitespace-nowrap text-xs font-semibold rounded-md px-2 py-1'

const bookingTone: Record<BookingStatus, string> = {
  pending: 'bg-sun text-onsun',
  approved: 'bg-cobalt text-oncobalt',
  rejected: 'border border-danger text-danger',
  cancelled: 'bg-mist text-muted',
}

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return <span className={`${base} ${bookingTone[status]}`}>{BOOKING_STATUS_LABEL[status]}</span>
}

const eventTone: Record<EventStatus, string> = {
  open: 'bg-cobalt text-oncobalt',
  scheduled: 'border border-cobalt text-cobalt',
  closed: 'bg-sun text-onsun',
  draft: 'border border-line text-muted',
  ended: 'bg-mist text-muted',
}

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return <span className={`${base} ${eventTone[status]}`}>{EVENT_STATUS_LABEL[status]}</span>
}

const accountTone: Record<AccountStatus, string> = {
  active: 'bg-cobalt/10 text-cobalt',
  pending: 'bg-sun text-onsun',
  rejected: 'border border-danger text-danger',
  suspended: 'bg-danger text-white',
}

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  return <span className={`${base} ${accountTone[status]}`}>{ACCOUNT_STATUS_LABEL[status]}</span>
}
