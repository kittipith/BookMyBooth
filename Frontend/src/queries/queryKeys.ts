/** key กลางของ TanStack Query ใช้ invalidate หลังแก้ข้อมูล (เพิ่มตามเฟสที่สลับหน้าจอ) */
export const queryKeys = {
  me: ['me'] as const,
  notifications: ['notifications'] as const,
  events: {
    all: ['events'] as const,
    detail: (eventId: string) => ['events', eventId] as const,
    lots: (eventId: string) => ['events', eventId, 'lots'] as const,
    summary: (eventId: string) => ['events', eventId, 'summary'] as const,
    /** การจองในงาน (ผู้จัดงาน) */
    bookings: (eventId: string) => ['events', eventId, 'bookings'] as const,
  },
  organizerEvents: ['organizer', 'events'] as const,
  vendors: ['organizer', 'vendors'] as const,
  admin: {
    users: ['admin', 'users'] as const,
    organizers: ['admin', 'organizers'] as const,
    events: ['admin', 'events'] as const,
  },
  myBookings: ['bookings', 'me'] as const,
  slip: (bookingId: string) => ['bookings', bookingId, 'slip'] as const,
}
