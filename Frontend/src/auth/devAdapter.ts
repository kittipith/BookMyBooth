import { api, ApiError } from '../api/client'
import { AuthError, type AuthAdapter } from './adapter'

/** token แบบ dev.<userId> ของ API จำลอง (ไม่มีวันหมดอายุ) เก็บไว้ให้เปิดแท็บใหม่แล้วยังล็อกอินอยู่ */
const TOKEN_KEY = 'bookmybooth-dev-token'

function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function writeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // เก็บไม่ได้ก็ยังใช้ได้จนกว่าจะปิดหน้า
  }
}

let token = readToken()

/** /_dev/* ตอบ error เป็น { error: { code: <ชื่อ exception ของ Cognito>, message } } */
async function call<T>(path: string, body?: unknown): Promise<T> {
  try {
    return await api.post<T>(`/_dev${path}`, body, { anonymous: true })
  } catch (e) {
    if (e instanceof ApiError && e.status === 400) throw new AuthError(e.code, e.message)
    throw e
  }
}

export const devAdapter: AuthAdapter = {
  mode: 'dev',

  async signUp(email, password, role) {
    await call('/sign-up', { email, password, role })
  },

  async confirmSignUp(email, code, profile) {
    await call('/confirm', { email, code, profile })
  },

  // ไม่มีอีเมลจริงให้ส่ง
  async resendCode() {},

  async signIn(email, password) {
    try {
      const result = await call<{ accessToken: string }>('/sign-in', { email, password })
      token = result.accessToken
      writeToken(token)
      return 'done'
    } catch (e) {
      if (e instanceof AuthError && e.code === 'UserNotConfirmedException') return 'confirm_sign_up'
      throw e
    }
  },

  async signOut() {
    token = null
    writeToken(null)
  },

  async forgotPassword() {},

  async confirmForgotPassword(email, code, newPassword) {
    await call('/reset-password', { email, code, newPassword })
  },

  async getAccessToken() {
    return token
  },

  // group อ่านใหม่ทุก request อยู่แล้ว
  async refreshSession() {},
}
