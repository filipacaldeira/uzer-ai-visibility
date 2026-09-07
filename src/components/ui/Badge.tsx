import { categoryColor } from '../../utils/format'

interface BadgeProps {
  label: string
  color?: string
  variant?: 'category' | 'status' | 'default'
}

const STATUS_STYLES: Record<string, string> = {
  'open': 'bg-brand-primary/15 text-brand-primary border border-brand-primary/30',
  'in_progress': 'bg-brand-warning/15 text-brand-warning border border-brand-warning/30',
  'in-progress': 'bg-brand-warning/15 text-brand-warning border border-brand-warning/30',
  'completed': 'bg-brand-success/15 text-brand-success border border-brand-success/30',
  'dismissed': 'bg-brand-dim/15 text-brand-muted border border-brand-border',
}

export function Badge({ label, variant = 'default' }: BadgeProps) {
  if (variant === 'status') {
    const cls = STATUS_STYLES[label.toLowerCase()] || STATUS_STYLES['open']
    return <span className={`badge ${cls} capitalize`}>{label.replace('_', ' ')}</span>
  }
  if (variant === 'category') {
    const hex = categoryColor(label)
    return (
      <span className="badge text-xs font-semibold" style={{ backgroundColor: hex + '20', color: hex, border: `1px solid ${hex}40` }}>
        {label}
      </span>
    )
  }
  return (
    <span className="badge bg-brand-elevated text-brand-muted border border-brand-border">
      {label}
    </span>
  )
}
