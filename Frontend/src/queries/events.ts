import { useQueries, useQuery } from '@tanstack/react-query'
import { getEvent, getEventLots, listEvents } from '../api/events'
import { eventFromDto, lotStatesFromDto } from '../api/mappers'
import type { LotStates } from '../types'
import { queryKeys } from './queryKeys'

/** สถานะล็อกเปลี่ยนตามคนอื่นจอง จึงให้เก่าได้ไม่นาน */
const LOTS_STALE_MS = 15_000

/** งานที่เผยแพร่แล้วทั้งหมด (สถานะ open / scheduled / closed / ended คำนวณโดย backend) */
export function useEvents() {
  return useQuery({
    queryKey: queryKeys.events.all,
    queryFn: async ({ signal }) => (await listEvents(signal)).items.map(eventFromDto),
  })
}

/** งานที่เปิดรับจองอยู่ เรียงตามวันเริ่มงาน */
export function useOpenEvents() {
  const query = useEvents()
  const open = (query.data ?? []).filter((e) => e.status === 'open').sort((a, b) => a.startDate.localeCompare(b.startDate))
  return { ...query, open }
}

/** รายละเอียดงานพร้อมผัง (404 = ไม่มีหรือยังเป็นฉบับร่าง) */
export function useEventDetail(eventId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.events.detail(eventId ?? ''),
    queryFn: async ({ signal }) => eventFromDto(await getEvent(eventId!, signal)),
    enabled: !!eventId,
    // หน้าแสดง "ไม่พบงาน" เอง
    meta: { silentError: true },
  })
}

export function useEventLots(eventId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.events.lots(eventId ?? ''),
    queryFn: async ({ signal }) => lotStatesFromDto((await getEventLots(eventId!, signal)).items),
    enabled: !!eventId,
    staleTime: LOTS_STALE_MS,
  })
}

/** สถานะล็อกของหลายงานพร้อมกัน (หน้ารายการงาน) งานที่ยังโหลดไม่เสร็จไม่อยู่ในผลลัพธ์ */
export function useLotsOfEvents(eventIds: string[]): Record<string, LotStates> {
  return useQueries({
    queries: eventIds.map((id) => ({
      queryKey: queryKeys.events.lots(id),
      queryFn: async ({ signal }: { signal: AbortSignal }) => lotStatesFromDto((await getEventLots(id, signal)).items),
      staleTime: LOTS_STALE_MS,
    })),
    combine: (results) =>
      Object.fromEntries(results.flatMap((r, i) => (r.data ? [[eventIds[i], r.data] as const] : []))) as Record<string, LotStates>,
  })
}
