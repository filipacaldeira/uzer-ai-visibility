import { Calendar, RefreshCw, ChevronDown } from 'lucide-react'

interface HeaderProps {
  title: string
  subtitle?: string
  timeRange: string
  onTimeRangeChange: (v: string) => void
  lastUpdated?: string
}

const TIME_OPTIONS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
]

export function Header({ title, subtitle, timeRange, onTimeRangeChange, lastUpdated }: HeaderProps) {
  const selected = TIME_OPTIONS.find(o => o.value === timeRange)

  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="text-sm text-brand-muted mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {lastUpdated && (
          <span className="text-xs text-brand-dim hidden sm:flex items-center gap-1">
            <RefreshCw size={11} />
            {lastUpdated}
          </span>
        )}
        <div className="relative">
          <select
            value={timeRange}
            onChange={e => onTimeRangeChange(e.target.value)}
            className="appearance-none bg-brand-elevated border border-brand-border text-brand-text text-sm pl-8 pr-8 py-2 rounded-lg cursor-pointer focus:outline-none focus:border-brand-primary"
          >
            {TIME_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-muted pointer-events-none" />
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-muted pointer-events-none" />
        </div>
      </div>
    </div>
  )
}
