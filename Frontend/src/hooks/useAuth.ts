import { useContext } from 'react'
import { accountProfile } from '../services/auth'
import { AuthContext } from '../store/authContext'
import { useAppStore } from './useAppStore'

export function useAuth() {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('useAuth ต้องใช้ภายใน AuthProvider')
  return auth
}

/** ชื่อและองค์กรของบัญชีที่เข้าสู่ระบบอยู่ */
export function useAccountProfile() {
  const { account } = useAuth()
  const { shops, organizers } = useAppStore()
  return account ? accountProfile(account, shops, organizers) : null
}
