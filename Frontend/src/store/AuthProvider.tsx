import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ROLE_LABEL } from '../data/options'
import { AUTH_RULES } from '../data/settings'
import { useAppStore } from '../hooks/useAppStore'
import { authenticate, AUTH_ERROR, generateOtp, hashPassword, normalizeEmail, passwordError, validateRegistration } from '../services/auth'
import type { Account, Role } from '../types'
import { AuthContext, type AuthStore, type LoginRequest, type OtpPurpose, type OtpTicket } from './authContext'

const SESSION_KEY = 'bookmybooth-session'

function readSession() {
  try {
    return localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

const wrongRole = (actual: Role, required: Role) =>
  `บัญชีนี้เป็นบัญชี${ROLE_LABEL[actual]} ใช้บัญชี${ROLE_LABEL[required]}เพื่อทำรายการนี้`

const otpKey = (email: string, purpose: OtpPurpose) => `${purpose}:${normalizeEmail(email)}`

export function AuthProvider({ children }: { children: ReactNode }) {
  const { accounts, createAccount, verifyAccountEmail, setAccountPassword, setDraft } = useAppStore()
  const [accountId, setAccountId] = useState<string | null>(readSession)
  const [loginRequest, setLoginRequest] = useState<LoginRequest | null>(null)
  // รหัส OTP ที่ส่งไปแล้ว (หลังบ้านจริงเก็บที่ Cognito)
  const [otps, setOtps] = useState<Record<string, OtpTicket>>({})

  useEffect(() => {
    try {
      if (accountId) localStorage.setItem(SESSION_KEY, accountId)
      else localStorage.removeItem(SESSION_KEY)
    } catch {
      // เก็บ session ไม่ได้ ก็ยังใช้งานได้จนกว่าจะปิดหน้า
    }
  }, [accountId])

  // บัญชีที่ถูกลบหรือถูกระงับระหว่างใช้งาน ถือว่าออกจากระบบแล้ว
  const found = accounts.find((a) => a.id === accountId)
  const account = found && found.status !== 'suspended' && found.emailVerified ? found : null

  const openLogin = useCallback((request: LoginRequest = {}) => setLoginRequest(request), [])
  const closeLogin = useCallback(() => setLoginRequest(null), [])

  const signIn = useCallback(
    (next: Account) => {
      setAccountId(next.id)
      setLoginRequest(null)
      loginRequest?.onSuccess?.(next)
    },
    [loginRequest],
  )

  const sendOtp = useCallback<AuthStore['sendOtp']>((email, purpose) => {
    setOtps((o) => ({ ...o, [otpKey(email, purpose)]: { code: generateOtp(), expiresAt: Date.now() + AUTH_RULES.otpMinutes * 60_000 } }))
  }, [])

  const lastOtp = useCallback<AuthStore['lastOtp']>((email, purpose) => otps[otpKey(email, purpose)], [otps])

  /** ลบรหัสที่ใช้แล้ว ใช้ซ้ำไม่ได้ */
  const dropOtp = useCallback((email: string, purpose: OtpPurpose) => {
    setOtps((o) => {
      const next = { ...o }
      delete next[otpKey(email, purpose)]
      return next
    })
  }, [])

  /** ตรวจรหัส OTP คืนข้อความผิดพลาด หรือ null */
  const checkOtp = useCallback(
    (email: string, purpose: OtpPurpose, code: string) => {
      const ticket = otps[otpKey(email, purpose)]
      if (!ticket || ticket.code !== code.trim()) return AUTH_ERROR.otpInvalid
      if (Date.now() > ticket.expiresAt) return AUTH_ERROR.otpExpired
      return null
    },
    [otps],
  )

  const login = useCallback<AuthStore['login']>(
    (email, password) => {
      const result = authenticate(accounts, email, password)
      if (!result.account) return { error: result.error }
      const acc = result.account
      if (acc.status === 'suspended') return { error: AUTH_ERROR.suspended(acc.statusReason) }
      const required = loginRequest?.role
      if (required && acc.role !== required) return { error: wrongRole(acc.role, required) }
      if (!acc.emailVerified) {
        sendOtp(acc.email, 'verify')
        return { verifyEmail: acc.email }
      }
      signIn(acc)
      return {}
    },
    [accounts, loginRequest, sendOtp, signIn],
  )

  const register = useCallback<AuthStore['register']>(
    (input) => {
      const errors = validateRegistration(input, accounts)
      if (Object.keys(errors).length) return { errors }
      const created = createAccount(input)
      sendOtp(created.email, 'verify')
      return { verifyEmail: created.email }
    },
    [accounts, createAccount, sendOtp],
  )

  const verifyEmail = useCallback<AuthStore['verifyEmail']>(
    (email, code) => {
      const error = checkOtp(email, 'verify', code)
      if (error) return error
      const acc = accounts.find((a) => a.email === normalizeEmail(email))
      if (!acc) return AUTH_ERROR.invalid
      verifyAccountEmail(acc.id)
      dropOtp(email, 'verify')
      signIn({ ...acc, emailVerified: true })
      return null
    },
    [accounts, checkOtp, dropOtp, signIn, verifyAccountEmail],
  )

  const resetPassword = useCallback<AuthStore['resetPassword']>(
    (email, code, newPassword) => {
      const error = checkOtp(email, 'reset', code)
      if (error) return error
      const pwError = passwordError(newPassword)
      if (pwError) return pwError
      const acc = accounts.find((a) => a.email === normalizeEmail(email))
      if (!acc) return AUTH_ERROR.otpInvalid
      setAccountPassword(acc.id, hashPassword(acc.email, newPassword))
      dropOtp(email, 'reset')
      return null
    },
    [accounts, checkOtp, dropOtp, setAccountPassword],
  )

  const logout = useCallback(() => {
    setAccountId(null)
    setDraft(null)
  }, [setDraft])

  const requireAuth = useCallback<AuthStore['requireAuth']>(
    (role, action, message) => {
      if (account?.role === role) action(account)
      else setLoginRequest({ role, message, onSuccess: action })
    },
    [account],
  )

  const value = useMemo(
    () => ({
      account, loginRequest, openLogin, closeLogin, login, register, sendOtp, lastOtp, verifyEmail, resetPassword, logout, requireAuth,
    }),
    [account, loginRequest, openLogin, closeLogin, login, register, sendOtp, lastOtp, verifyEmail, resetPassword, logout, requireAuth],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
