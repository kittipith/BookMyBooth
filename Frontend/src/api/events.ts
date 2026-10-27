import { api } from './client'
import type { EventDto, EventListItemDto, ItemsDto, LotDto } from './dto'

/** งานที่เผยแพร่แล้ว (OPEN/CLOSED) ไม่มีผังและบัญชีรับเงิน */
export const listEvents = (signal?: AbortSignal) => api.get<ItemsDto<EventListItemDto>>('/events', { anonymous: true, signal })

/** งานฉบับร่างได้ 404 */
export const getEvent = (eventId: string, signal?: AbortSignal) =>
  api.get<EventDto>(`/events/${encodeURIComponent(eventId)}`, { anonymous: true, signal })

/** ล็อกทั้งหมดของงาน ราคามาจากโซน backend ปล่อยล็อกที่หมดเวลาจองให้ก่อนตอบ */
export const getEventLots = (eventId: string, signal?: AbortSignal) =>
  api.get<ItemsDto<LotDto>>(`/events/${encodeURIComponent(eventId)}/lots`, { anonymous: true, signal })
