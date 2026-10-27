import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { isApiError, setSessionErrorHandler } from '../api/client'
import { getMe } from '../api/me'
import { accountFromDto, roleFromDto } from '../api/mappers'
import { AuthError, authAdapter, authErrorMessage, SUSPENDED_MESSAGE, type SignupProfile } from '../auth'
import { ROLE_LABEL } from '../data/options'
import { useAppStore } from '../hooks/useAppStore'
import { queryKeys } from '../queries/queryKeys'
import { clearDraft } from '../services/bookingDraft'
import { AUTH_ERROR, meProfile, normalizeEmail, passwordError, signupProfile, validateRegistration } from '../services/auth'
import type { Role } from '../types'
import { AuthContext, type AuthStore, type LoginRequest, type LoginResult } from './authContext'

/** checking = กำลังดูว่ามี session เดิมไหม (ตอนเปิดหน้า) */
type Session = 'checking' | 'in' | 'out'

const wrongRole = (actual: Role, required: Role) =>
  `บัญชีนี้เป็นบัญชี${ROLE_LABEL[actual]} ใช้บัญชี${ROLE_LABEL[required]}เพื่อทำรายการนี้`

// ค่าฟอร์มสมัครระหว่างรอรหัสยืนยัน ต้องส่งไปกับ confirmSignUp (F6) เก็บใน sessionStorage เผื่อรีเฟรชหน้า
const profileKey = (email: string) => `bookmybooth-signup:${normalizeEmail(email)}`

function saveProfile(email: string, profile: SignupProfile) {
  try {
    sessionStorage.setItem(profileKey(email), JSON.stringify(profile))
  } catch {
    // เก็บไม่ได้ก็ยืนยันได้ แค่โปรไฟล์ว่าง (แก้ทีหลังได้ที่หน้าโปรไฟล์)
  }
}

function loadProfile(email: string): SignupProfile {
  try {
    const raw = sessionStorage.getItem(profileKey(email))
    if (raw) return JSON.parse(raw) as SignupProfile
  } catch {
    // ใช้ค่าว่าง
  }
  return { name: '', phone: '', orgName: '' }
}

function clearProfile(email: string) {
  try {
    sessionStorage.removeItem(profileKey(email))
  } catch {
    // ไม่เป็นไร
  }
}

const fetchMe = { queryKey: queryKeys.me, queryFn: ({ signal }: { signal: AbortSignal }) => getMe(signal), meta: { silentError: true } }

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient()
  const { setDraft, syncProfile } = useAppStore()
  const [session, setSession] = useState<Session>('checking')
  const [loginRequest, setLoginRequest] = useState<LoginRequest | null>(null)
  // รหัสผ่านที่เพิ่งกรอก ใช้เข้าสู่ระบบให้ต่อทันทีหลังยืนยันอีเมล (อยู่ในหน่วยความจำเท่านั้น)
  const pending = useRef<{ email: string; password: string } | null>(null)
  const sessionRef = useRef(session)
  useEffect(() => {
    sessionRef.current = session
  }, [session])

  const meQuery = useQuery({ ...fetchMe, enabled: session === 'in', staleTime: 60_000 })
  const me = session === 'in' ? (meQuery.data ?? null) : null
  const account = useMemo(() => (me ? accountFromDto(me) : null), [me])

  const signOutLocal = useCallback(async () => {
    pending.current = null
    setSession('out')
    client.clear()
    setDraft(null)
    clearDraft()
    await authAdapter.signOut().catch(() => {})
  }, [client, setDraft])

  // เปิดหน้า: มี token เดิมก็โหลดโปรไฟล์ก่อนแสดงหน้า ไม่งั้นหน้าที่ต้องล็อกอินจะเด้ง popup แวบหนึ่ง
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const token = await authAdapter.getAccessToken()
      if (!token) {
        if (!cancelled) setSession('out')
        return
      }
      try {
        await client.fetchQuery(fetchMe)
      } catch (e) {
        // token ใช้ไม่ได้แล้ว (เช่น API จำลองเปิดใหม่ บัญชีเดิมหายไป) ส่วนเน็ตหลุดให้ลองใหม่ทีหลัง
        if (isApiError(e) && (e.status === 401 || e.status === 403)) {
          await authAdapter.signOut().catch(() => {})
          if (!cancelled) setSession('out')
          return
        }
      }
      if (!cancelled) setSession('in')
    })()
    return () => {
      cancelled = true
    }
  }, [client])

  // token หมดอายุ หรือถูกระงับระหว่างใช้งาน → ออกจากระบบ
  useEffect(() => {
    setSessionErrorHandler((error) => {
      if (sessionRef.current !== 'in') return
      void signOutLocal()
      if (error.code === 'ACCOUNT_SUSPENDED') setLoginRequest({ message: SUSPENDED_MESSAGE })
      else if (error.status === 401) setLoginRequest({ message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง' })
    })
  }, [signOutLocal])

  // ชั่วคราวจนถึงเฟส 8: หน้าที่ยังใช้ข้อมูลจำลองหาร้าน/ผู้จัดงานจาก userId
  useEffect(() => {
    if (me) syncProfile(me)
  }, [me, syncProfile])

  // สถานะบัญชีเปลี่ยน (เช่น Admin อนุมัติผู้จัดงาน) ต้องขอ token ใหม่ให้ได้ group ล่าสุด (F7)
  const lastStatus = useRef<string | null>(null)
  useEffect(() => {
    const status = me?.status ?? null
    if (lastStatus.current && status && lastStatus.current !== status) void authAdapter.refreshSession().catch(() => {})
    lastStatus.current = status
  }, [me?.status])

  const openLogin = useCallback((request: LoginRequest = {}) => setLoginRequest(request), [])
  const closeLogin = useCallback(() => setLoginRequest(null), [])

  /** หลัง Cognito ล็อกอินผ่าน: โหลดโปรไฟล์ ตรวจบทบาท แล้วถือว่าเข้าสู่ระบบ */
  const finishSignIn = useCallback(async (): Promise<LoginResult> => {
    let profile
    try {
      profile = await client.fetchQuery({ ...fetchMe, staleTime: 0 })
    } catch (e) {
      await authAdapter.signOut().catch(() => {})
      client.removeQueries({ queryKey: queryKeys.me })
      return { error: isApiError(e, 'ACCOUNT_SUSPENDED') ? SUSPENDED_MESSAGE : authErrorMessage(e) }
    }
    const role = roleFromDto(profile.role)
    const required = loginRequest?.role
    if (required && role !== required) {
      await authAdapter.signOut().catch(() => {})
      client.removeQueries({ queryKey: queryKeys.me })
      return { error: wrongRole(role, required) }
    }
    setSession('in')
    setLoginRequest(null)
    loginRequest?.onSuccess?.(accountFromDto(profile))
    return { name: meProfile(profile).name }
  }, [client, loginRequest])

  const login = useCallback<AuthStore['login']>(
    async (rawEmail, password) => {
      const email = normalizeEmail(rawEmail)
      if (!email || !password) return { error: AUTH_ERROR.missing }
      try {
        const result = await authAdapter.signIn(email, password)
        if (result === 'confirm_sign_up') {
          pending.current = { email, password }
          // Cognito ไม่ส่งรหัสให้เองตอนล็อกอิน
          await authAdapter.resendCode(email).catch(() => {})
          return { verifyEmail: email }
        }
      } catch (e) {
        return { error: authErrorMessage(e) }
      }
      return finishSignIn()
    },
    [finishSignIn],
  )

  const register = useCallback<AuthStore['register']>(async (input) => {
    const errors = validateRegistration(input)
    if (Object.keys(errors).length) return { errors }
    const email = normalizeEmail(input.email)
    try {
      await authAdapter.signUp(email, input.password, input.role)
    } catch (e) {
      const message = authErrorMessage(e)
      if (e instanceof AuthError && e.code === 'UsernameExistsException') return { errors: { email: message } }
      if (e instanceof AuthError && e.code === 'InvalidPasswordException') return { errors: { password: message } }
      return { error: message }
    }
    saveProfile(email, signupProfile(input))
    pending.current = { email, password: input.password }
    return { verifyEmail: email }
  }, [])

  const verifyEmail = useCallback<AuthStore['verifyEmail']>(
    async (rawEmail, code) => {
      const email = normalizeEmail(rawEmail)
      if (!code.trim()) return { error: AUTH_ERROR.codeMissing }
      try {
        await authAdapter.confirmSignUp(email, code, loadProfile(email))
      } catch (e) {
        return { error: authErrorMessage(e) }
      }
      clearProfile(email)
      const creds = pending.current?.email === email ? pending.current : null
      pending.current = null
      if (!creds) return { signedIn: false }
      const result = await login(creds.email, creds.password)
      return { error: result.error, name: result.name, signedIn: !result.error }
    },
    [login],
  )

  const sendOtp = useCallback<AuthStore['sendOtp']>(async (rawEmail, purpose) => {
    const email = normalizeEmail(rawEmail)
    try {
      if (purpose === 'verify') await authAdapter.resendCode(email)
      else await authAdapter.forgotPassword(email)
      return null
    } catch (e) {
      // ไม่บอกว่ามีบัญชีนี้หรือไม่ เพื่อไม่ให้ใช้เดาอีเมลในระบบได้
      if (e instanceof AuthError && e.code === 'UserNotFoundException') return null
      return authErrorMessage(e)
    }
  }, [])

  const resetPassword = useCallback<AuthStore['resetPassword']>(async (rawEmail, code, newPassword) => {
    if (!code.trim()) return AUTH_ERROR.codeMissing
    const pwError = passwordError(newPassword)
    if (pwError) return pwError
    try {
      await authAdapter.confirmForgotPassword(normalizeEmail(rawEmail), code, newPassword)
      return null
    } catch (e) {
      return authErrorMessage(e)
    }
  }, [])

  const logout = useCallback(() => signOutLocal(), [signOutLocal])

  const refreshAccount = useCallback(async () => {
    await authAdapter.refreshSession().catch(() => {})
    await client.invalidateQueries({ queryKey: queryKeys.me })
  }, [client])

  const requireAuth = useCallback<AuthStore['requireAuth']>(
    (role, action, message) => {
      if (account?.role === role) action(account)
      else setLoginRequest({ role, message, onSuccess: action })
    },
    [account],
  )

  const value = useMemo<AuthStore>(
    () => ({
      account, me, authMode: authAdapter.mode, loginRequest, openLogin, closeLogin, login, register, sendOtp, verifyEmail,
      resetPassword, logout, refreshAccount, requireAuth,
    }),
    [account, me, loginRequest, openLogin, closeLogin, login, register, sendOtp, verifyEmail, resetPassword, logout, refreshAccount, requireAuth],
  )

  if (session === 'checking') {
    return (
      <div className="min-h-screen grid place-items-center text-muted" role="status">
        กำลังโหลด…
      </div>
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
