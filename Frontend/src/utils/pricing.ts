import type { PublicEvent } from '../types'

export function zoneOf(event: Pick<PublicEvent, 'zones'>, zoneId: string) {
  return event.zones.find((z) => z.id === zoneId)
}

/** รหัสโซนจากรหัสล็อก เช่น A01 → A */
export function lotZoneId(lot: string) {
  return lot.replace(/\d+$/, '')
}
