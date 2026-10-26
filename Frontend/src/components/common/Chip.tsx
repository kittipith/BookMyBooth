import type { ReactNode } from 'react'

interface ChipProps {
  pressed: boolean
  onClick: () => void
  children: ReactNode
  role?: 'tab'
  className?: string
}

export default function Chip({ pressed, onClick, children, role, className = 'px-3.5' }: ChipProps) {
  return (
    <button
      type="button"
      role={role}
      aria-selected={role === 'tab' ? pressed : undefined}
      aria-pressed={pressed}
      onClick={onClick}
      className={`chip border border-line rounded-full py-1.5 text-sm hover:border-cobalt ${className}`}
    >
      {children}
    </button>
  )
}
