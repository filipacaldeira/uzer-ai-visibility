interface ScoreGaugeProps {
  score: number
  maxScore?: number
  size?: number
  loading?: boolean
}

export function ScoreGauge({ score, maxScore = 100, size = 150, loading }: ScoreGaugeProps) {
  const pct = Math.min(score / maxScore, 1)
  const r = (size / 2) - 14
  const circumference = 2 * Math.PI * r
  const arc = circumference * 0.75
  const offset = arc - (pct * arc)

  // Color: cyan always for brand consistency, glow shifts with performance
  const strokeColor = '#06B6D4'
  const glowColor = score >= 70 ? '#DFFF11' : score >= 40 ? '#06B6D4' : '#06B6D4'

  const cx = size / 2
  const cy = size / 2

  if (loading) {
    return <div className="skeleton rounded-full" style={{ width: size, height: size }} />
  }

  const label = score >= 70 ? 'Strong' : score >= 40 ? 'Growing' : score >= 20 ? 'Emerging' : 'Low'
  const labelColor = score >= 70 ? '#DFFF11' : score >= 40 ? '#F59E0B' : '#06B6D4'

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(135deg)' }}>
          {/* Track */}
          <circle cx={cx} cy={cy} r={r}
            fill="none" stroke="#3D4A66" strokeWidth={8}
            strokeDasharray={`${arc} ${circumference}`}
            strokeLinecap="round"
            opacity={0.7}
          />
          {/* Glow layer */}
          <circle cx={cx} cy={cy} r={r}
            fill="none" stroke={glowColor} strokeWidth={14}
            strokeDasharray={`${arc} ${circumference}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            opacity={0.08}
          />
          {/* Value arc */}
          <circle cx={cx} cy={cy} r={r}
            fill="none" stroke={strokeColor} strokeWidth={8}
            strokeDasharray={`${arc} ${circumference}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)', filter: `drop-shadow(0 0 6px ${strokeColor}60)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingBottom: '12px' }}>
          <span className="text-[2.2rem] font-bold text-brand-text leading-none">{score}</span>
          <span className="text-xs text-brand-dim mt-0.5">/ {maxScore}</span>
          <span className="text-2xs font-semibold mt-1 px-2 py-0.5 rounded-full" style={{ backgroundColor: labelColor + '20', color: labelColor }}>
            {label}
          </span>
        </div>
      </div>
    </div>
  )
}
