interface ProgressBarProps {
  value: number
  className?: string
  barClassName?: string
}

export default function ProgressBar({ value, className = 'w-28 h-2', barClassName = 'bg-cobalt' }: ProgressBarProps) {
  return (
    <div className={`bg-mist rounded-sm overflow-hidden ${className}`}>
      <div className={`h-full ${barClassName}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}
