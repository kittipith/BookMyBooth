import { useMemo } from 'react'
import { seededRandom } from '../../utils/random'

const N = 25

/** ลาย QR จำลองจากข้อความ (ใช้แสดงผลในหน้าตัวอย่าง ไม่ได้เข้ารหัสจริง) */
function buildMatrix(value: string) {
  const rand = seededRandom(value)
  const m: boolean[][] = Array.from({ length: N }, () => Array.from({ length: N }, () => rand() > 0.52))
  const finder = (r0: number, c0: number) => {
    for (let r = -1; r <= 7; r++)
      for (let c = -1; c <= 7; c++) {
        const rr = r0 + r
        const cc = c0 + c
        if (rr < 0 || cc < 0 || rr >= N || cc >= N) continue
        const ring = Math.max(Math.abs(r - 3), Math.abs(c - 3))
        m[rr][cc] = ring !== 2 && ring !== 4
      }
  }
  finder(0, 0)
  finder(0, N - 7)
  finder(N - 7, 0)
  for (let i = 8; i < N - 8; i++) {
    m[6][i] = i % 2 === 0
    m[i][6] = i % 2 === 0
  }
  return m
}

export default function QrCode({ value, size = 220 }: { value: string; size?: number }) {
  const matrix = useMemo(() => buildMatrix(value), [value])
  return (
    <svg width={size} height={size} viewBox={`0 0 ${N} ${N}`} shapeRendering="crispEdges" role="img" aria-label={`QR ${value}`}>
      {matrix.flatMap((row, r) =>
        row.map((on, c) => (on ? <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#0E1A3D" /> : null)),
      )}
    </svg>
  )
}
