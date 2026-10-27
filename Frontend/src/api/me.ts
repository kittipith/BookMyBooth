import { api } from './client'
import type { UpdateMeDto, UserDto } from './dto'

export const getMe = (signal?: AbortSignal) => api.get<UserDto>('/me', { signal })

/** ส่งเฉพาะฟิลด์ที่แก้ แต่ละบทบาทแก้ได้ไม่เท่ากัน (PLAN 4.1) ไม่งั้นได้ 400 FIELD_NOT_ALLOWED */
export const updateMe = (changes: UpdateMeDto) => api.put<UserDto>('/me', changes)
