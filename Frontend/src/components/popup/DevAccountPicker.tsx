import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { RoleDto } from '../../api/dto'
import { roleFromDto } from '../../api/mappers'
import { config } from '../../config'
import { ROLE_LABEL } from '../../data/options'
import { DEMO_ACCOUNTS } from '../../data/settings'

interface DevAccount {
  email: string
  password: string
  role: RoleDto
}

/** บัญชีเดโมบน AWS: อีเมลตาม scripts/seed.py รหัสผ่านจาก VITE_DEMO_PASSWORD */
const hostedAccounts: DevAccount[] = config.demoPassword
  ? DEMO_ACCOUNTS.map((account) => ({ ...account, password: config.demoPassword }))
  : []

/**
 * ปุ่มเลือกบัญชีเดโม
 * - โหมด dev: ดึงจาก API จำลอง (GET /_dev/accounts)
 * - โหมด cognito: แสดงเมื่อตั้ง VITE_DEMO_PASSWORD (AWS-SETUP ข้อ 8.1) ไม่ตั้ง = ไม่แสดง
 */
export default function DevAccountPicker({ onPick }: { onPick: (account: DevAccount) => void }) {
  const { data } = useQuery({
    queryKey: ['_dev', 'accounts'],
    queryFn: ({ signal }) => api.get<{ items: DevAccount[] }>('/_dev/accounts', { anonymous: true, signal }),
    staleTime: Infinity,
    enabled: config.authMode === 'dev',
    meta: { silentError: true },
  })
  const accounts = config.authMode === 'dev' ? (data?.items ?? []) : hostedAccounts
  if (!accounts.length) return null

  return (
    <div className="mb-4 rounded-lg bg-mist px-3 py-2 text-sm">
      <span className="text-muted">โหมดทดลอง ใช้บัญชีเดโม:</span>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {accounts.map((account) => (
          <button
            key={account.email}
            type="button"
            onClick={() => onPick(account)}
            className="rounded-full border border-line bg-surface px-3 py-1 font-semibold hover:border-cobalt"
          >
            {ROLE_LABEL[roleFromDto(account.role)]}
          </button>
        ))}
      </div>
    </div>
  )
}
