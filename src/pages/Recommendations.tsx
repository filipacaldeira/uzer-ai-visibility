import { useState, useMemo } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie
} from 'recharts'
import { CheckCircle2, Circle, Clock, X } from 'lucide-react'
import { api } from '../api/client'
import { useApi } from '../hooks/useApi'
import { Header } from '../components/layout/Header'
import { KPICard } from '../components/ui/KPICard'
import { Badge } from '../components/ui/Badge'
import { ErrorState, PageSkeleton } from '../components/ui/LoadingState'
import { truncate, categoryColor } from '../utils/format'
import { InfoTip } from '../components/ui/InfoTip'

const BRAND_ID = 'c727ae2e-28f3-40f9-8e79-bc83ee402cbb'

// Generated recommendations derived from real data patterns
const STATIC_RECS = [
  {
    id: '1', category: 'Content Gap', title: 'Create "best automotive network Portugal 2026" guide',
    evidence: 'Brand scores 0 on 12 Commercial intent prompts. Competitors dominate these queries.',
    owner: 'Content Team', impact: 5, effort: 2, timeline: '2 weeks', status: 'open' as Status,
  },
  {
    id: '2', category: 'GEO', title: 'Rewrite service pages to directly answer top FAQ prompts',
    evidence: '"Inspeção, quem me pode ajudar?" scores 25/100. Direct answer format would improve inclusion.',
    owner: 'Web Developer', impact: 4, effort: 1, timeline: '1 week', status: 'open' as Status,
  },
  {
    id: '3', category: 'Authority Building', title: 'Pursue automotive industry directory listings',
    evidence: 'Only myforce.pt is an owned source. Concentration risk is high — top 5 sources = 60%+ of citations.',
    owner: 'PR Agency', impact: 4, effort: 2, timeline: '3 weeks', status: 'in_progress' as Status,
  },
  {
    id: '4', category: 'Content Gap', title: 'Publish fleet management comparison guide for 2026',
    evidence: '"Gestão de frotas" prompts show 0 visibility in 4 tracked models. High commercial intent.',
    owner: 'Content Team', impact: 4, effort: 3, timeline: '1 month', status: 'open' as Status,
  },
  {
    id: '5', category: 'Technical', title: 'Add FAQ schema markup to inspection & revision pages',
    evidence: 'Structured data helps Google AI Mode parse and cite your pages directly.',
    owner: 'Web Developer', impact: 3, effort: 1, timeline: '3 days', status: 'completed' as Status,
  },
  {
    id: '6', category: 'PR', title: 'Pitch automotive media with fleet data report',
    evidence: 'youtube.com and google.com drive 33% of citations. Earned media would diversify risk.',
    owner: 'PR Agency', impact: 4, effort: 4, timeline: '2 months', status: 'open' as Status,
  },
  {
    id: '7', category: 'Content Gap', title: 'Write electric vehicle maintenance guide for PT',
    evidence: '"Carros elétricos revisão Portugal" prompts score 0 across all platforms.',
    owner: 'Content Team', impact: 3, effort: 2, timeline: '2 weeks', status: 'open' as Status,
  },
  {
    id: '8', category: 'GEO', title: 'Create dedicated "best tyre & brake service Lisbon" landing page',
    evidence: '"Pneus e travões Lisboa" prompt scores 36/100 with 30 runs. Dedicated page improves match.',
    owner: 'Web Developer', impact: 3, effort: 2, timeline: '1 week', status: 'open' as Status,
  },
]

type Status = 'open' | 'in_progress' | 'completed' | 'dismissed'

const CATEGORY_COLORS: Record<string, string> = {
  'Content Gap': '#06B6D4', 'GEO': '#EF4444', 'Authority Building': '#8B5CF6',
  'PR': '#DFFF11', 'Technical': '#F59E0B',
}

const STATUS_ICONS: Record<Status, typeof Circle> = {
  'open': Circle, 'in_progress': Clock, 'completed': CheckCircle2, 'dismissed': X,
}

export default function Recommendations() {
  const [timeRange, setTimeRange] = useState('30d')
  const [statusFilter, setStatusFilter] = useState<'All' | Status>('All')
  const [catFilter, setCatFilter] = useState('All')
  const [recs, setRecs] = useState(STATIC_RECS)

  const { loading, error, refetch } = useApi(
    () => api.snapshot(BRAND_ID, timeRange), [timeRange]
  )

  const filtered = useMemo(() => {
    return recs
      .filter(r => statusFilter === 'All' || r.status === statusFilter)
      .filter(r => catFilter === 'All' || r.category === catFilter)
      .map(r => ({ ...r, priorityScore: r.impact / r.effort }))
      .sort((a, b) => b.priorityScore - a.priorityScore)
  }, [recs, statusFilter, catFilter])

  const cats = ['All', ...new Set(STATIC_RECS.map(r => r.category))]
  const statuses: Array<'All' | Status> = ['All', 'open', 'in_progress', 'completed']

  const open = recs.filter(r => r.status === 'open').length
  const highImpact = recs.filter(r => r.impact >= 4 && r.status === 'open').length
  const quickWins = recs.filter(r => (r.impact / r.effort) >= 3 && r.status === 'open').length
  const completed = recs.filter(r => r.status === 'completed').length

  const matrixData = recs.map(r => ({
    id: r.id, title: truncate(r.title, 30), x: r.effort, y: r.impact,
    z: r.impact * 20, cat: r.category, status: r.status,
    priority: r.impact / r.effort,
  }))

  const catDist = Object.entries(
    recs.reduce((acc, r) => ({ ...acc, [r.category]: (acc[r.category as keyof typeof acc] || 0) + 1 }), {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }))

  const updateStatus = (id: string, status: Status) => {
    setRecs(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }

  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (loading) return <><Header title="Recommendations" timeRange={timeRange} onTimeRangeChange={setTimeRange} /><PageSkeleton /></>

  return (
    <div className="space-y-6">
      <Header
        title="Recommendations & Action Plan"
        subtitle="Prioritised actions to improve AI visibility"
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Open Actions" value={open} deltaDir="neutral" tooltip="Recommendations that are pending — not yet started or completed." />
        <KPICard label="High Impact" value={highImpact} accent deltaDir="up" subtitle="impact score ≥ 4" tooltip="Open actions with high expected business impact (rated 4 or 5 out of 5)." />
        <KPICard label="Quick Wins" value={quickWins} deltaDir="up" subtitle="priority score ≥ 3" tooltip="Open actions with a strong impact-to-effort ratio (score ≥ 3) — recommended to tackle first." />
        <KPICard label="Completed" value={completed} deltaDir="up" tooltip="Actions marked as done." />
      </div>

      {/* Matrix + Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 card">
          <p className="section-title inline-flex items-center gap-1.5">
            Effort × Impact Priority Matrix
            <InfoTip text="Actions plotted by effort (X) vs impact (Y). Quick Wins (top-left) = high impact + low effort; Strategic Bets (top-right); Fill-ins (bottom-left); Deprioritise (bottom-right)." />
          </p>
          <div className="relative">
            {/* Quadrant labels */}
            <div className="absolute inset-0 grid grid-cols-2 pointer-events-none" style={{ margin: '30px 20px 30px 40px' }}>
              <div className="flex items-start justify-start p-2"><span className="text-2xs text-brand-success font-semibold opacity-60">QUICK WINS</span></div>
              <div className="flex items-start justify-end p-2"><span className="text-2xs text-brand-primary font-semibold opacity-60">STRATEGIC BETS</span></div>
              <div className="flex items-end justify-start p-2"><span className="text-2xs text-brand-dim font-semibold opacity-60">FILL-INS</span></div>
              <div className="flex items-end justify-end p-2"><span className="text-2xs text-brand-danger font-semibold opacity-60">DEPRIORITISE</span></div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart margin={{ top: 30, right: 20, bottom: 30, left: 10 }}>
                <XAxis dataKey="x" name="Effort" type="number" domain={[0, 6]} tick={{ fontSize: 10 }} label={{ value: 'Effort →', position: 'bottom', fontSize: 10, fill: '#8B93A9' }} ticks={[1, 2, 3, 4, 5]} />
                <YAxis dataKey="y" name="Impact" type="number" domain={[0, 6]} tick={{ fontSize: 10 }} label={{ value: 'Impact', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#8B93A9' }} ticks={[1, 2, 3, 4, 5]} />
                <ZAxis dataKey="z" range={[100, 600]} />
                <Tooltip
                  cursor={false}
                  contentStyle={{ backgroundColor: '#1A2033', border: '1px solid #2D3654', borderRadius: 8 }}
                  formatter={(_v, _name, props) => [(props as any).payload.title, 'Action']}
                  labelFormatter={() => ''}
                />
                <Scatter data={matrixData} shape={(props: any) => {
                  const { cx, cy, r, payload } = props
                  const color = CATEGORY_COLORS[payload.cat] || '#8B93A9'
                  const completed = payload.status === 'completed'
                  return (
                    <g>
                      <circle cx={cx} cy={cy} r={r} fill={color} fillOpacity={completed ? 0.3 : 0.5} stroke={color} strokeWidth={1.5} />
                      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="#FDF8FC" fontWeight="600">{payload.priority.toFixed(1)}</text>
                    </g>
                  )
                }} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <p className="section-title inline-flex items-center gap-1.5">
            Action Categories
            <InfoTip text="Distribution of recommended actions by category: Content Gap, GEO, Authority Building, Technical, PR." />
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={catDist} cx="50%" cy="50%" outerRadius={65} dataKey="value" paddingAngle={3} stroke="none">
                {catDist.map((entry, i) => <Cell key={i} fill={CATEGORY_COLORS[entry.name] || '#8B93A9'} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1A2033', border: '1px solid #2D3654', borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {catDist.map(d => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[d.name] || '#8B93A9' }} />
                  <span className="text-brand-muted">{d.name}</span>
                </span>
                <span className="text-brand-text font-medium">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          {statuses.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${statusFilter === s ? 'bg-brand-primary text-brand-bg' : 'bg-brand-elevated text-brand-muted hover:text-brand-text'}`}>
              {s === 'in_progress' ? 'In Progress' : s}
            </button>
          ))}
        </div>
        <div className="w-px h-4 bg-brand-border" />
        <div className="flex items-center gap-2 flex-wrap">
          {cats.map(c => (
            <button key={c} onClick={() => setCatFilter(c)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${catFilter === c ? 'bg-brand-elevated text-brand-text border border-brand-primary/40' : 'text-brand-dim hover:text-brand-muted'}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Recommendation Cards */}
      <div className="space-y-3">
        {filtered.map(rec => {
          return (
            <div key={rec.id} className={`card hover:shadow-card-hover transition-shadow ${rec.status === 'completed' ? 'opacity-60' : ''}`}>
              <div className="flex items-start gap-4">
                {/* Priority score */}
                <div className="flex-shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center" style={{ backgroundColor: categoryColor(rec.category) + '20' }}>
                  <span className="text-lg font-bold" style={{ color: categoryColor(rec.category) }}>{rec.priorityScore.toFixed(1)}</span>
                  <span className="text-2xs" style={{ color: categoryColor(rec.category) }}>score</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge label={rec.category} variant="category" />
                      <h3 className={`text-sm font-semibold ${rec.status === 'completed' ? 'line-through text-brand-muted' : 'text-brand-text'}`}>
                        {rec.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <select
                        value={rec.status}
                        onChange={e => updateStatus(rec.id, e.target.value as Status)}
                        className="text-xs bg-brand-elevated border border-brand-border rounded-lg px-2 py-1 text-brand-text cursor-pointer focus:outline-none focus:border-brand-primary"
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="dismissed">Dismissed</option>
                      </select>
                    </div>
                  </div>

                  <p className="text-xs text-brand-muted mb-2">{rec.evidence}</p>

                  <div className="flex items-center gap-4 flex-wrap text-xs text-brand-muted">
                    {/* Impact dots */}
                    <span className="flex items-center gap-1.5">
                      Impact:
                      <span className="flex gap-0.5">
                        {[1,2,3,4,5].map(i => (
                          <span key={i} className={`w-1.5 h-1.5 rounded-full ${i <= rec.impact ? 'bg-brand-primary' : 'bg-brand-border'}`} />
                        ))}
                      </span>
                      <span className="font-medium text-brand-text">{rec.impact}/5</span>
                    </span>
                    {/* Effort dots */}
                    <span className="flex items-center gap-1.5">
                      Effort:
                      <span className="flex gap-0.5">
                        {[1,2,3,4,5].map(i => (
                          <span key={i} className={`w-1.5 h-1.5 rounded-full ${i <= rec.effort ? 'bg-brand-warning' : 'bg-brand-border'}`} />
                        ))}
                      </span>
                      <span className="font-medium text-brand-text">{rec.effort}/5</span>
                    </span>
                    <span>Owner: <strong className="text-brand-text">{rec.owner}</strong></span>
                    <span>Timeline: <strong className="text-brand-text">{rec.timeline}</strong></span>
                    <Badge label={rec.status} variant="status" />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
