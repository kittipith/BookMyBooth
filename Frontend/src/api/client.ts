import { config } from '../config'

/**
 * error จาก backend อยู่ในรูป { error: { code, message, details } }
 * ส่วน 401/404 ที่ API Gateway ตอบเองเป็น { message } จึงต้องรองรับทั้งสองแบบ
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

/** status 0 = เรียกเซิร์ฟเวอร์ไม่ได้เลย (ปิดอยู่ / เน็ตหลุด / CORS) */
const NETWORK_ERROR = new ApiError(0, 'NETWORK_ERROR', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่')

type TokenProvider = () => Promise<string | null>

let getToken: TokenProvider = async () => null
let onSessionError: (error: ApiError) => void = () => {}

/** auth adapter (เฟส 2) ตั้งตัวอ่าน token ที่ใช้แนบทุก request */
export function setTokenProvider(provider: TokenProvider) {
  getToken = provider
}

/** เรียกเมื่อ session ใช้ไม่ได้แล้ว (401 หรือบัญชีถูกระงับ) ให้ AuthProvider ออกจากระบบ */
export function setSessionErrorHandler(handler: (error: ApiError) => void) {
  onSessionError = handler
}

/** 401 = token ใช้ไม่ได้ · ACCOUNT_SUSPENDED = ถูกระงับระหว่างใช้งาน (token ยังไม่หมดอายุ) */
export const isSessionError = (error: ApiError) => error.status === 401 || error.code === 'ACCOUNT_SUSPENDED'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export type Query = Record<string, string | number | boolean | null | undefined>

function buildUrl(path: string, query?: Query) {
  const url = `${config.apiUrl}${path}`
  if (!query) return url
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  const search = params.toString()
  return search ? `${url}?${search}` : url
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: unknown
  try {
    body = await response.json()
  } catch {
    body = null
  }
  const error = (body as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error
  if (error) {
    return new ApiError(response.status, error.code ?? 'ERROR', error.message ?? 'เกิดข้อผิดพลาด', error.details)
  }
  if (response.status === 401) return new ApiError(401, 'UNAUTHORIZED', 'กรุณาเข้าสู่ระบบอีกครั้ง')
  if (response.status === 404) return new ApiError(404, 'NOT_FOUND', 'ไม่พบข้อมูลที่ต้องการ')
  if (response.status === 429) return new ApiError(429, 'TOO_MANY_REQUESTS', 'มีการใช้งานมากเกินไป กรุณารอสักครู่')
  return new ApiError(response.status, 'ERROR', 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่')
}

export interface FetchOptions {
  query?: Query
  /** ไม่แนบ token แม้ล็อกอินอยู่ (route สาธารณะ) */
  anonymous?: boolean
  signal?: AbortSignal
}

/** เรียก API แล้วคืน JSON ที่ได้ ถ้าไม่ใช่ 2xx จะ throw ApiError */
export async function apiFetch<T>(method: HttpMethod, path: string, body?: unknown, options: FetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (!options.anonymous) {
    const token = await getToken()
    if (token) headers.authorization = `Bearer ${token}`
  }

  let response: Response
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: options.signal,
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    throw NETWORK_ERROR
  }

  if (!response.ok) {
    const error = await toApiError(response)
    if (isSessionError(error)) onSessionError(error)
    throw error
  }
  if (response.status === 204) return undefined as T
  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export const api = {
  get: <T>(path: string, options?: FetchOptions) => apiFetch<T>('GET', path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: FetchOptions) => apiFetch<T>('POST', path, body ?? {}, options),
  put: <T>(path: string, body?: unknown, options?: FetchOptions) => apiFetch<T>('PUT', path, body ?? {}, options),
}

/** ข้อความสำหรับแสดงผู้ใช้ จาก error อะไรก็ได้ */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return 'เกิดข้อผิดพลาด กรุณาลองใหม่'
}

export function isApiError(error: unknown, code?: string): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code)
}
