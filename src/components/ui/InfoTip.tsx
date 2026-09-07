import { Info } from 'lucide-react'

interface InfoTipProps {
  text: string
  size?: number
  className?: string
}

export function InfoTip({ text, size = 12, className = '' }: InfoTipProps) {
  return (
    <span
      className={`relative inline-flex items-center justify-center text-brand-dim hover:text-brand-muted align-middle group/tip ${className}`}
    >
      <Info size={size} />
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-50 hidden group-hover/tip:block w-64 p-2.5 rounded-md bg-brand-card border border-brand-border shadow-lg text-2xs font-normal text-brand-text normal-case tracking-normal leading-snug"
      >
        {text}
      </span>
    </span>
  )
}
