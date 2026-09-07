import { useState, useMemo } from 'react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell
} from 'recharts'
import { api } from '../api/client'
import { MY_BRAND_COLOR, brandColor, brandStroke } from '../utils/format'
import { InfoTip } from '../components/ui/InfoTip'
import { useApi } from '../hooks/useApi'
import { Header } from '../components/layout/Header'
import { KPICard } from '../components/ui/KPICard'
import { ErrorState, PageSkeleton } from '../components/ui/LoadingState'

const BRAND_ID = 'c727ae2e-28f3-40f9-8e79-bc83ee402cbb'


export default function Competitors() {
  const [timeRange, setTimeRange] = useState('30d')

  const { data: comp, loading, error, refetch } = useApi(
    () => api.competitors(BRAND_ID, timeRange), [timeRange]
  )
  const { data: snap } = useApi(
    () => api.snapshot(BRAND_ID, timeRange), [timeRange]
  )

  const radarData = useMemo(() => {
    if (!comp || !snap) return []
    const brand = comp.brand
    const topComp = comp.competitors[0]
    return [
      { subject: 'Visibility', brand: brand.score, [topComp?.name || 'Competitor']: topComp?.score || 0 },
      { subject: 'Citations', brand: Math.min((snap.visibility.totalCitations / 30) * 100, 100), [topComp?.name || 'Competitor']: 20 },
      { subject: 'Coverage', brand: Math.round((snap.prompts.filter(p => p.averageScore > 0).length / Math.max(snap.prompts.length, 1)) * 100), [topComp?.name || 'Competitor']: 30 },
      { subject: 'Avg Score', brand: Math.round(snap.prompts.reduce((s, p) => s + p.averageScore, 0) / Math.max(snap.prompts.length, 1)), [topComp?.name || 'Competitor']: topComp?.score ? topComp.score * 0.4 : 10 },
      { subject: 'Platforms', brand: Math.round(([...new Set(snap.prompts.flatMap(p => p.aiModels))].length / 6) * 100), [topComp?.name || 'Competitor']: 50 },
    ]
  }, [comp, snap])

  const sovData = useMemo(() => {
    if (!comp) return []
    const total = comp.brand.score + comp.competitors.reduce((s, c) => s + c.score, 0)
    return [
      { name: comp.brand.name.replace('Oficinas ', '').replace(' Portugal', ''), score: comp.brand.score, share: total > 0 ? Math.round((comp.brand.score / total) * 100) : 0, isMe: true },
      ...comp.competitors.map(c => ({
        name: c.name, score: c.score, share: total > 0 ? Math.round((c.score / total) * 100) : 0, isMe: false
      }))
    ].sort((a, b) => b.score - a.score)
  }, [comp])

  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (loading) return <><Header title="Competitor Comparison" timeRange={timeRange} onTimeRangeChange={setTimeRange} /><PageSkeleton /></>

  const topComp = comp?.competitors[0]
  const gap = (comp?.brand.score || 0) - (topComp?.score || 0)

  return (
    <div className="space-y-6">
      <Header
        title="Competitor Comparison"
        subtitle="Head-to-head AI visibility intelligence"
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Your Visibility Score"
          value={comp?.brand.score || 0}
          accent
          deltaDir="up"
          subtitle={`Rank #${comp?.summary.brandRankAmongCompetitors || 1} in category`}
          tooltip="Overall AI visibility score (0–100) for the brand across all LLMs and tracked prompts."
        />
        <KPICard
          label="Score Lead vs #1 Competitor"
          value={gap > 0 ? `+${gap}` : gap}
          deltaDir={gap >= 0 ? 'up' : 'down'}
          subtitle={`vs ${topComp?.name || '—'}`}
          tooltip="Difference between the brand's score and the top-ranked competitor's score. Positive = brand ahead."
        />
        <KPICard label="Competitors Tracked" value={comp?.summary.totalCompetitors || 0} subtitle="in your category" tooltip="Number of competitors being monitored in the same industry category." />
        <KPICard label="Avg Competitor Score" value={comp?.summary.averageCompetitorScore?.toFixed(1) || 0} subtitle="category average" tooltip="Average visibility score across all tracked competitors, excluding the brand itself." />
      </div>

      {/* Radar + SOV */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card">
          <p className="section-title inline-flex items-center gap-1.5">
            Multi-Dimension Comparison
            <InfoTip text="Radar chart comparing the brand vs top competitor across five dimensions: visibility, citations, coverage, avg score, and platform breadth." />
          </p>
          {radarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#1E2535" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#8B93A9' }} />
                <Radar name="MyForce" dataKey="brand" stroke={MY_BRAND_COLOR} fill={MY_BRAND_COLOR} fillOpacity={0.18} strokeWidth={2} />
                {topComp && (
                  <Radar name={topComp.name} dataKey={topComp.name} stroke={brandColor(topComp.name)} fill={brandColor(topComp.name)} fillOpacity={0.1} strokeWidth={1.5} strokeDasharray="4 2" />
                )}
              </RadarChart>
            </ResponsiveContainer>
          ) : null}
          <div className="flex items-center gap-4 mt-2 justify-center text-xs text-brand-muted">
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 inline-block" style={{ backgroundColor: MY_BRAND_COLOR }} />MyForce</span>
            {topComp && <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 inline-block" style={{ backgroundColor: brandColor(topComp.name) }} />{topComp.name}</span>}
          </div>
        </div>

        <div className="card">
          <p className="section-title inline-flex items-center gap-1.5">
            AI Visibility Score by Brand
            <InfoTip text="Ranked bar chart of all tracked brands by AI Visibility Score (0–100). Your brand appears in red." />
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={sovData} layout="vertical" margin={{ left: 0, right: 30 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1A2033', border: '1px solid #2D3654', borderRadius: 8 }}
                formatter={(v, name) => [name === 'score' ? `${v} / 100` : `${v}%`, name === 'score' ? 'Score' : 'Share']}
              />
              <Bar dataKey="score" radius={[0, 4, 4, 0]} maxBarSize={24} label={{ position: 'right', fontSize: 10, fill: '#8B93A9' }}>
                {sovData.map((entry, i) => {
                  const fill = entry.isMe ? MY_BRAND_COLOR : brandColor(entry.name)
                  return <Cell key={i} fill={fill} stroke={brandStroke(fill)} strokeWidth={brandStroke(fill) ? 1 : 0} />
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="card">
        <p className="section-title inline-flex items-center gap-1.5">
          Competitive Detail
          <InfoTip text="Per-brand table with visibility score, change vs prior period, monthly visits, rank, and lead/deficit vs your brand." />
        </p>
        <table className="w-full">
          <thead>
            <tr className="border-b border-brand-border">
              <th className="th">Brand</th>
              <th className="th">Visibility Score</th>
              <th className="th">Change</th>
              <th className="th">Monthly Visits</th>
              <th className="th">Rank</th>
              <th className="th">vs You</th>
            </tr>
          </thead>
          <tbody>
            {/* Your brand */}
            <tr className="table-row bg-brand-primary/5">
              <td className="td font-semibold text-brand-primary">{comp?.brand.name.replace('Oficinas ', '').replace(' Portugal', '')}</td>
              <td className="td">
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-brand-border rounded-full overflow-hidden">
                    <div className="h-full bg-brand-primary rounded-full" style={{ width: `${comp?.brand.score || 0}%` }} />
                  </div>
                  <span className="text-brand-primary font-semibold">{comp?.brand.score}</span>
                </div>
              </td>
              <td className="td text-brand-success capitalize">{comp?.brand.trend}</td>
              <td className="td text-brand-muted">—</td>
              <td className="td"><span className="badge bg-brand-primary/15 text-brand-primary">#{comp?.summary.brandRankAmongCompetitors}</span></td>
              <td className="td text-brand-muted">You</td>
            </tr>
            {comp?.competitors.map((c, i) => {
              const diff = (comp.brand.score) - c.score
              return (
                <tr key={c.id} className="table-row">
                  <td className="td font-medium">{c.name}</td>
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-brand-border rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${c.score}%`, backgroundColor: brandColor(c.name) }} />
                      </div>
                      <span>{c.score}</span>
                    </div>
                  </td>
                  <td className="td">
                    <span className={c.change.startsWith('+') ? 'text-brand-success' : 'text-brand-danger'}>{c.change}</span>
                  </td>
                  <td className="td text-brand-muted">{c.monthlyVisits?.toLocaleString() || '—'}</td>
                  <td className="td text-brand-muted">#{i + 2}</td>
                  <td className="td">
                    <span className={`text-xs font-medium ${diff > 0 ? 'text-brand-success' : 'text-brand-danger'}`}>
                      {diff > 0 ? '+' : ''}{diff} pts
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Strategic Insight Banner */}
      {gap > 0 && topComp && (
        <div className="card border-brand-success/20 bg-brand-success/5">
          <p className="text-xs text-brand-muted mb-1 uppercase tracking-wider font-medium">Competitive Position</p>
          <p className="text-sm text-brand-text">
            You lead <strong className="text-brand-text">{topComp.name}</strong> by <strong className="text-brand-success">{gap} points</strong> in AI visibility score.
            Your strongest advantage is brand awareness queries. Focus on closing the "best-in-category" gap to extend your lead.
          </p>
        </div>
      )}
    </div>
  )
}
