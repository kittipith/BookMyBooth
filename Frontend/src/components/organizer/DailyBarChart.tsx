import { shortDate } from '../../utils/format'

interface DailyBarChartProps {
  data: { date: string; count: number }[]
}

/** แท่งการจองรายวัน แท่งสุดท้าย (วันนี้) เป็นสีเหลือง */
export default function DailyBarChart({ data }: DailyBarChartProps) {
  const max = Math.max(...data.map((d) => d.count), 1)
  const total = data.reduce((sum, d) => sum + d.count, 0)
  return (
    <>
      <div className="mt-6 h-36 flex items-end gap-1.5" role="img" aria-label={`การจองรายวัน รวม ${total} คำขอ`}>
        {data.map((d, i) => (
          <div
            key={d.date}
            className={`flex-1 rounded-t-[3px] min-h-[2px] ${i === data.length - 1 ? 'bg-sun' : 'bg-cobalt'} ${d.count ? '' : 'opacity-25'}`}
            style={{ height: `${(d.count / max) * 100}%` }}
            title={`${shortDate(d.date).label}: ${d.count} การจอง`}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted">
        <span>{data.length ? shortDate(data[0].date).label : ''}</span>
        <span>วันนี้</span>
      </div>
    </>
  )
}
