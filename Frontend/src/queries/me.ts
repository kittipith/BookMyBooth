import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UpdateMeDto } from '../api/dto'
import { updateMe } from '../api/me'
import { queryKeys } from './queryKeys'

/** โปรไฟล์ของผู้ใช้ที่ล็อกอินอยู่อ่านจาก useAuth().me (AuthProvider เป็นคนโหลด ['me']) */
export function useUpdateMe() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (changes: UpdateMeDto) => updateMe(changes),
    onSuccess: (me) => client.setQueryData(queryKeys.me, me),
  })
}
