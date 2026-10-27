import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { RoleDto } from '../../api/dto'
import { roleFromDto } from '../../api/mappers'
import { ROLE_LABEL } from '../../data/options'

interface DevAccount {
  email: string
  password: string
  role: RoleDto
}

/** ปุ่มเลือกบัญชีเดโมของ API จำลอง (GET /_dev/accounts) แสดงเฉพาะ VITE_AUTH_MODE=dev */
export default function DevAccountPicker({ onPick }: { onPick: (account: DevAccount) => void }) {
  const { data } = useQuery({
    queryKey: ['_dev', 'accounts'],
    queryFn: ({ signal }) => api.get<{ items: DevAccount[] }>('/_dev/accounts', { anonymous: true, signal }),
    staleTime: Infinity,
    meta: { silentError: true },
  })
  if (!data?.items.length) return null

  return (
    <div className="mb-4 rounded-lg bg-mist px-3 py-2 text-sm">
      <span className="text-muted">โหมดทดลอง ใช้บัญชีเดโม:</span>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {data.items.map((account) => (
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
