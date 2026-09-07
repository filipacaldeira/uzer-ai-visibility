import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { type ReactNode } from 'react'
import { InfoTip } from './InfoTip'

interface KPICardProps {
  label: string
  value: string | number
  valueSuffix?: string
  delta?: string | number
  deltaDir?: 'up' | 'down' | 'neutral'
  subtitle?: string
  icon?: ReactNode
  accent?: boolean
  loading?: boolean
  tooltip?: string
}

export function KPICard({ label, value, valueSuffix, delta, deltaDir = 'neutral', subtitle, icon, accent, loading, tooltip }: KPICardProps) {
  if (loading) {
    return (
      <div className="card">
        <div className="skeleton h-2.5 w-24 mb-3 rounded" />
        <div className="skeleton h-8 w-16 mb-2 rounded" />
        <div className="skeleton h-2.5 w-20 rounded" />
      </div>
    )
  }

  const DeltaIcon = deltaDir === 'up' ? TrendingUp : deltaDir === 'down' ? TrendingDown : Minus
  const deltaClass = deltaDir === 'up' ? 'text-brand-success' : deltaDir === 'down' ? 'text-brand-danger' : 'text-brand-muted'
  const borderAccent = accent ? 'border-brand-primary/30' : ''

  return (
    <div
      className={`card group transition-all hover:border-brand-border-bright ${borderAccent}`}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-2xs text-brand-muted uppercase tracking-widest font-semibold inline-flex items-center gap-1">
          {label}
          {tooltip && <InfoTip text={tooltip} size={11} />}
        </span>
        {icon && <span className="text-brand-primary/50 group-hover:text-brand-primary transition-colors">{icon}</span>}
      </div>
      <div className={`flex items-baseline gap-2 mb-1.5 ${accent ? 'text-brand-primary' : 'text-brand-text'}`}>
        <span className="text-[1.75rem] font-bold leading-none">{value}</span>
        {valueSuffix && <span className="text-xs font-medium text-brand-muted">{valueSuffix}</span>}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {delta !== undefined && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ${deltaClass}`}>
            <DeltaIcon size={11} />
            {delta}
          </span>
        )}
        {subtitle && <span className="text-xs text-brand-muted">{subtitle}</span>}
      </div>
    </div>
  )
}
