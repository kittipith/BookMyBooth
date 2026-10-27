import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { getSlipUrl } from '../../api/bookings'
import { queryKeys } from '../../queries/queryKeys'

/** ลิงก์สลิปมีอายุ 5 นาที ขอใหม่ก่อนหมด */
const SLIP_URL_STALE_MS = 4 * 60_000

/**
 * สลิปการโอนที่ผู้ขายแนบมา (GET /bookings/{id}/slip) สลิปเดียวต่อชุด
 * รูปแสดงในหน้าเลย ส่วน PDF (รูปโหลดไม่ขึ้น) ให้เปิดในแท็บใหม่
 */
export default function SlipCard({ bookingId }: { bookingId: string }) {
  const [notImage, setNotImage] = useState(false)
  const { data, isPending, isError } = useQuery({
    queryKey: queryKeys.slip(bookingId),
    queryFn: () => getSlipUrl(bookingId),
    staleTime: SLIP_URL_STALE_MS,
    meta: { silentError: true },
  })

  if (isPending) return <p className="text-sm text-muted">กำลังโหลดสลิป…</p>
  if (isError || !data) return <p className="text-sm text-danger">โหลดสลิปไม่ได้</p>
  return (
    <div>
      {notImage ? (
        <p className="bg-mist rounded-xl p-4 text-sm">สลิปเป็นไฟล์ PDF</p>
      ) : (
        <img src={data.url} alt="สลิปการโอน" onError={() => setNotImage(true)} className="mx-auto max-h-[420px] rounded-xl border border-line" />
      )}
      <a href={data.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-cobalt font-semibold hover:underline underline-offset-4">
        เปิดสลิปในแท็บใหม่
      </a>
    </div>
  )
}
