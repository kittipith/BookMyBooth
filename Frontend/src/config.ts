/**
 * ค่าที่ต่างกันระหว่าง API จำลองในเครื่องกับ AWS อ่านจาก env ของ Vite
 * ดูค่าตัวอย่างใน .env.example และ AWS-SETUP หัวข้อ 14.2
 */

export type AuthMode = 'dev' | 'cognito'

function readAuthMode(value: string | undefined): AuthMode {
  return value === 'cognito' ? 'cognito' : 'dev'
}

export const config = {
  /** ไม่มี / ท้าย เช่น http://localhost:3001 หรือ Invoke URL ของ API Gateway */
  apiUrl: (import.meta.env.VITE_API_URL ?? 'http://localhost:3001').replace(/\/+$/, ''),
  /** dev = ล็อกอินผ่าน /_dev/* ของ API จำลอง, cognito = Amplify + Cognito จริง */
  authMode: readAuthMode(import.meta.env.VITE_AUTH_MODE),
  userPoolId: import.meta.env.VITE_USER_POOL_ID ?? '',
  userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID ?? '',
  region: import.meta.env.VITE_REGION ?? 'us-east-1',
  /**
   * รหัสผ่านบัญชีเดโมจาก scripts/seed.py (SEED_PASSWORD) ใส่แล้วหน้าเข้าสู่ระบบแสดงปุ่มบัญชีเดโมในโหมด cognito ด้วย
   * ⚠️ ค่านี้ฝังอยู่ในไฟล์ JS ที่ทุกคนเปิดดูได้ ใช้กับบัญชีเดโมเท่านั้น
   */
  demoPassword: import.meta.env.VITE_DEMO_PASSWORD ?? '',
} as const
