import { useContext } from 'react'
import { meProfile } from '../services/auth'
import { AuthContext } from '../store/authContext'

export function useAuth() {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('useAuth ต้องใช้ภายใน AuthProvider')
  return auth
}

/** ชื่อและองค์กรของบัญชีที่เข้าสู่ระบบอยู่ (จาก GET /me) */
export function useAccountProfile() {
  const { me } = useAuth()
  return me ? meProfile(me) : null
}
