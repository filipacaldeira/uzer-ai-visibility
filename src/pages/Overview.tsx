import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
  LineChart, Line, PieChart, Pie
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, ArrowRight, Zap } from 'lucide-react'
import { api, type SnapshotData } from '../api/client'
import { useApi } from '../hooks/useApi'
import { Header } from '../components/layout/Header'
import { KPICard } from '../components/ui/KPICard'
import { ScoreGauge } from '../components/ui/ScoreGauge'
import { InfoTip } from '../components/ui/InfoTip'
import { ErrorState, PageSkeleton } from '../components/ui/LoadingState'
import { formatRelativeDate, scoreTrend, BRAND_PALETTE, MY_BRAND_COLOR, brandColor, brandStroke } from '../utils/format'
import { useBrandVisibilityStats } from '../hooks/useBrandVisibilityStats'

const BRAND_ID = 'c727ae2e-28f3-40f9-8e79-bc83ee402cbb'

function TrendArrow({ trend }: { trend: string }) {
  const dir = scoreTrend(trend)
  if (dir === 'up') return <TrendingUp size={14} className="text-brand-success" />
  if (dir === 'down') return <TrendingDown size={14} className="text-brand-danger" />
  return <Minus size={14} className="text-brand-muted" />
}

function Sparkline({ score, trend }: { score: number; trend: string }) {
  const data = useMemo(() => {
    const points = 10
    return Array.from({ length: points }, (_, i) => {
      const progress = i / (points - 1)
      const noise = (Math.random() - 0.5) * 6
      const base = trend === 'up'
        ? score - (1 - progress) * 8 + noise
        : trend === 'down'
        ? score + (1 - progress) * 8 + noise
        : score + noise
      return { v: Math.max(0, Math.min(100, Math.round(base))) }
    })
  }, [score, trend])

  return (
    <ResponsiveContainer width={120} height={32}>
      <LineChart data={data}>
        <Line
          type="monotone" dataKey="v" stroke={MY_BRAND_COLOR}
          strokeWidth={1.5} dot={false} isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

interface CompetitorRow { name: string; score: number; sentiment: number | null; isMe: boolean }

function CompetitorChart({ data, colorMap, height = 170, yWidth = 140 }: { data: CompetitorRow[]; colorMap: Record<string, string>; height?: number; yWidth?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 82, top: 0, bottom: 0 }}>
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#2C3F70', strokeWidth: 1 }} />
        <YAxis
          type="category"
          dataKey="name"
          width={yWidth}
          tickLine={false}
          axisLine={false}
          interval={0}
          tick={(props: any) => (
            <text x={props.x} y={props.y} dy={4} textAnchor="end" fill="#8B93A9" fontSize={11}>
              {props.payload.value}
            </text>
          )}
        />
        <Tooltip
          contentStyle={{ backgroundColor: '#1A2033', border: '1px solid #2D3654', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#FDF8FC' }}
          itemStyle={{ color: '#8B93A9' }}
          formatter={(v) => [`${v}%`, 'Visibility']}
        />
        <Bar dataKey="score" radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false}>
          {data.map((entry, i) => {
            const fill = entry.isMe ? MY_BRAND_COLOR : (colorMap[entry.name] || BRAND_PALETTE[i % BRAND_PALETTE.length])
            return <Cell key={i} fill={fill} stroke={brandStroke(fill)} strokeWidth={brandStroke(fill) ? 1 : 0} />
          })}
          <LabelList
            dataKey="score"
            position="right"
            content={(props: any) => {
              const { x, y, width, height: h, value, index } = props
              const entry = data[index]
              const sent = entry?.sentiment
              const sentColor = sent == null ? '#8B93A9' : sent >= 80 ? '#DFFF11' : sent >= 60 ? '#F59E0B' : '#EA3624'
              // Right edge of the plot area (domain is fixed 0–100, so scale from this bar)
              const plotRight = value > 0 ? x + (width * 100) / value : null
              return (
                <g>
                  <text x={x + width + 6} y={y + h / 2} fontSize={10} fill="#FDF8FC" dominantBaseline="middle" fontWeight={600}>
                    {value}%
                  </text>
                  {sent != null && plotRight != null && (
                    <text x={plotRight} y={y + h / 2} textAnchor="end" fontSize={10.5} fill={sentColor} dominantBaseline="middle" fontWeight={600}>
                      {`+${sent}%`}
                    </text>
                  )}
                </g>
              )
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export default function Overview() {
  const [timeRange, setTimeRange] = useState('30d')
  const [hoverSlice, setHoverSlice] = useState<{ name: string; value: number; isMe: boolean } | null>(null)
  const navigate = useNavigate()

  const { data: snap, loading, error, refetch } = useApi<SnapshotData>(
    () => api.snapshot(BRAND_ID, timeRange), [timeRange]
  )
  const { data: vis, loading: visLoading, refetch: refetchVis } = useApi(
    () => api.visibility(BRAND_ID, timeRange), [timeRange]
  )
  // Run-level aggregation across all prompts (visibility % / sentiment / position
  // per brand). Gated until the core endpoints settle so the 50-request detail
  // flood doesn't starve the slow /visibility endpoint upstream.
  const brandStats = useBrandVisibilityStats(BRAND_ID, timeRange, !loading && !visLoading)

  // If /visibility failed on first load (slow upstream), retry it once after
  // the detail flood has finished — heals the "zeros" state automatically.
  const retriedVis = useRef(false)
  useEffect(() => {
    if (!vis && !visLoading && brandStats !== null && !retriedVis.current) {
      retriedVis.current = true
      refetchVis()
    }
  }, [vis, visLoading, brandStats, refetchVis])

  if (error) return <ErrorState message={error} onRetry={refetch} />
  // Skeleton only on the initial load — the automatic /visibility retry after the
  // detail flood must not blank a page that is already showing content.
  const initialLoading = (loading && !snap) || (visLoading && !vis && !retriedVis.current)
  if (initialLoading) return (
    <><Header title="Executive Overview" timeRange={timeRange} onTimeRangeChange={setTimeRange} /><PageSkeleton /></>
  )

  const competitors = snap?.competitors || []


  // Chart data: real run-level aggregation (matches native Peekaboo UI) once
  // loaded; falls back to the API composite scores while details stream in.
  // The run history is a truncated sample, so sampled visibility ratios are
  // anchored to the official brand visibility score from the /visibility endpoint.
  const statsReady = brandStats !== null && brandStats.all.length > 0
  const mySampled = statsReady ? brandStats.all.find(s => s.isMe)?.visibility ?? 0 : 0
  const calib = statsReady && mySampled > 0 && vis?.visibility.score ? vis.visibility.score / mySampled : 1
  const toChartRows = (rows: { name: string; visibility: number; sentiment: number | null; isMe: boolean }[]) =>
    rows.map(s => ({ name: s.name, score: Math.round(s.visibility * calib), sentiment: s.sentiment, isMe: s.isMe }))
  const sovData = statsReady
    ? toChartRows(brandStats.all)
    : [
        {
          name: snap?.brand.name?.replace('Oficinas ', '').replace(' Portugal', '') || 'MyForce',
          score: vis?.visibility.score || 0,
          sentiment: null as number | null,
          isMe: true,
        },
        ...competitors.map(c => ({ name: c.name, score: c.score, sentiment: null as number | null, isMe: false }))
      ].sort((a, b) => b.score - a.score)

  // Per-brand share-of-voice slices (mentions split across all tracked brands,
  // from the run-history sample); 2-slice fallback while details load
  const totalBrandMentions = statsReady ? brandStats.all.reduce((s, b) => s + b.mentions, 0) : 0
  const sovSlices = statsReady && totalBrandMentions > 0
    ? brandStats.all.map(b => ({
        name: b.name,
        value: Math.round((b.mentions / totalBrandMentions) * 1000) / 10,
        isMe: b.isMe,
      }))
    : [
        { name: 'MyForce', value: Math.max(vis?.marketShare.percentage || 0, 0.001), isMe: true },
        { name: 'Others', value: Math.max(100 - (vis?.marketShare.percentage || 0), 0.001), isMe: false },
      ]

  const LLM_CHARTS: Array<{ model: string; label: string }> = [
    { model: 'gpt-4o-mini', label: 'ChatGPT' },
    { model: 'google-ai-mode', label: 'Google AI Mode' },
    { model: 'google-aio', label: 'AI Overviews' },
  ]

  // Daily visibility series for the line chart (real run dates from the history sample)
  const timelineData = statsReady
    ? brandStats.timeline.map(t => ({
        label: new Date(t.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        ...t.values,
      }))
    : []

  // Stable colour per competitor across every chart, assigned from the All-LLMs ranking
  const brandColorMap: Record<string, string> = {}
  {
    sovData.forEach(r => {
      if (!r.isMe) brandColorMap[r.name] = brandColor(r.name)
    })
  }

  const lastUpdated = snap ? formatRelativeDate(snap.snapshotDate) : ''
  const marketShare = vis?.marketShare.percentage || 0
  // "Visibility" = % of analysed AI runs mentioning the brand — same metric the Peekaboo UI shows
  const score = vis?.visibility.score || 0
  const computedRank = statsReady ? brandStats.all.findIndex(s => s.isMe) + 1 : 0
  const rank = computedRank || snap?.visibility.rank || 0
  const trend = vis?.visibility.trend || 'stable'

  return (
    <div className="space-y-5">
      <Header
        title="Executive Overview"
        subtitle="AI visibility status at a glance"
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        lastUpdated={lastUpdated}
      />

      {/* KPI Row — 2 small heroes + 2x2 grid of 4 tiles (compact) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Left half: two small colour heroes side by side */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* LIME Hero — AI Visibility Score */}
          <div
            className="rounded-xl px-4 py-3 relative hover:z-30 shadow-[0_6px_16px_-12px_rgba(223,255,17,0.4)]"
            style={{
              background: 'linear-gradient(135deg, #F0FF6E 0%, #DFFF11 45%, #98C20A 100%)',
              color: '#0B0F1A',
            }}
          >
            <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none"><div className="absolute -top-6 -right-6 w-16 h-16 rounded-full opacity-40" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.6) 0%, transparent 70%)' }} /></div>
            <div className="flex items-center justify-between relative mb-1">
              <span className="text-2xs font-bold uppercase tracking-wider opacity-80 inline-flex items-center gap-1">
                AI Visibility
                <InfoTip text="% of analysed AI answers (runs) that mention the brand in the selected period — the same headline metric shown in the Peekaboo app." size={10} />
              </span>
              <span className="inline-flex items-center gap-1 text-[0.6rem] font-medium opacity-80">
                <TrendArrow trend={trend} />
                <span className="capitalize">{trend}</span>
                <span className="opacity-40">·</span>
                <span>#{rank}</span>
              </span>
            </div>
            <div className="flex items-end gap-1.5 relative">
              <div className="text-6xl font-extrabold leading-none tracking-tight">{score}</div>
              <div className="text-base font-semibold opacity-60 pb-1">%</div>
            </div>
          </div>

          {/* CYAN Hero — AI Share of Voice */}
          <div
            className="rounded-xl px-4 py-3 relative hover:z-30 shadow-[0_6px_16px_-12px_rgba(6,182,212,0.4)]"
            style={{
              background: 'linear-gradient(135deg, #5BE2F2 0%, #06B6D4 45%, #06647A 100%)',
              color: '#06121A',
            }}
          >
            <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none"><div className="absolute -top-6 -right-6 w-16 h-16 rounded-full opacity-35" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.7) 0%, transparent 70%)' }} /></div>
            <div className="flex items-center justify-between relative mb-1">
              <span className="text-2xs font-bold uppercase tracking-wider opacity-80 inline-flex items-center gap-1">
                Share of Voice
                <InfoTip text="Brand mentions as share of all tracked category mentions across LLMs." size={10} />
              </span>
              {hoverSlice ? (
                <span
                  className="text-[0.65rem] font-bold px-1.5 py-0.5 rounded-full inline-flex items-center gap-1"
                  style={{ backgroundColor: 'rgba(11,15,26,0.85)', color: hoverSlice.isMe ? MY_BRAND_COLOR : ((brandColorMap[hoverSlice.name] === '#000000' ? '#FDF8FC' : brandColorMap[hoverSlice.name]) || '#FDF8FC') }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hoverSlice.isMe ? MY_BRAND_COLOR : (brandColorMap[hoverSlice.name] || '#FDF8FC'), boxShadow: '0 0 0 1px rgba(255,255,255,0.35)' }} />
                  {hoverSlice.name} {hoverSlice.value}%
                </span>
              ) : (
                <span className="text-[0.6rem] font-medium opacity-80">
                  {vis?.marketShare.brandMentions || 0} of {vis?.marketShare.totalMentions || 0}
                </span>
              )}
            </div>
            <div className="flex items-end justify-between gap-2 relative">
              <div className="flex items-end gap-1.5">
                <div className="text-6xl font-extrabold leading-none tracking-tight">{Math.round(marketShare)}</div>
                <div className="text-base font-semibold opacity-70 pb-1">%</div>
              </div>
              {/* Donut: share of voice per brand (dashboard-consistent colours) */}
              <div className="w-[74px] h-[74px] -mb-1 -mr-1 rounded-full" style={{ backgroundColor: 'rgba(11,15,26,0.30)' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sovSlices}
                      cx="50%" cy="50%" innerRadius={20} outerRadius={33}
                      dataKey="value" startAngle={90} endAngle={-270}
                      stroke="rgba(11,15,26,0.55)" strokeWidth={1.5} isAnimationActive={false}
                      onMouseEnter={(_, i) => setHoverSlice(sovSlices[i] || null)}
                      onMouseLeave={() => setHoverSlice(null)}
                    >
                      {sovSlices.map((s, i) => (
                        <Cell
                          key={i}
                          fill={s.isMe ? MY_BRAND_COLOR : (brandColorMap[s.name] || 'rgba(11,15,26,0.25)')}
                          stroke={brandStroke(brandColorMap[s.name] || '') || 'rgba(11,15,26,0.55)'}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Right half: 2 KPI tiles */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="card !p-3 !rounded-xl flex flex-col justify-center">
            <div className="text-2xs uppercase tracking-wider text-brand-muted font-semibold inline-flex items-center gap-1">
              Prompts Tracked
              <InfoTip text="Total prompt runs analysed in this period." size={10} />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <div className="text-4xl font-extrabold text-brand-text leading-none tabular-nums">
                {vis?.visibility.runCount?.toLocaleString() || '—'}
              </div>
              <div className="text-sm font-medium text-brand-dim">last {timeRange}</div>
            </div>
          </div>
          <div className="card !p-3 !rounded-xl flex flex-col justify-center">
            <div className="text-2xs uppercase tracking-wider text-brand-muted font-semibold inline-flex items-center gap-1">
              Category Rank
              <InfoTip text="Brand's position among tracked competitors in this category." size={10} />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <div className="text-4xl font-extrabold text-brand-text leading-none">#{rank}</div>
              <div className="text-sm font-medium text-brand-dim">/{competitors.length + 1} competitors</div>
            </div>
          </div>
        </div>
      </div>

      {/* Visibility over time + All-LLMs snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <p className="section-title mb-0 inline-flex items-center gap-1.5">
              Visibility Over Time — <span className="text-brand-text">All LLMs</span>
              <InfoTip text="Daily Peekaboo visibility score per brand (position-weighted, 0-100): the mean score of that day's analysed AI answers, where answers not mentioning the brand count as 0. Computed from the per-prompt run history, which the API caps at the 100 most recent runs per prompt." />
            </p>
            <button onClick={() => navigate('/trends')} className="text-xs text-brand-primary flex items-center gap-1 hover:underline">
              Details <ArrowRight size={12} />
            </button>
          </div>
          {!statsReady ? (
            <div className="h-[200px] flex items-center justify-center text-2xs text-brand-dim">loading run history…</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={176}>
                <LineChart data={timelineData} margin={{ left: -22, right: 10, top: 5, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} tickLine={false} axisLine={{ stroke: '#2C3F70', strokeWidth: 1 }} interval="preserveStartEnd" minTickGap={28} />
                  <YAxis domain={[0, 'auto']} tick={{ fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}%`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1A2033', border: '1px solid #2D3654', borderRadius: 8, fontSize: 11 }}
                    labelStyle={{ color: '#FDF8FC' }}
                    formatter={(v: unknown, name: unknown) => [`${v}%`, String(name)]}
                  />
                  {sovData.map(b => (
                    <Line
                      key={b.name}
                      type="monotone"
                      dataKey={b.name}
                      stroke={b.isMe ? MY_BRAND_COLOR : brandColorMap[b.name]}
                      strokeWidth={b.isMe ? 2.5 : 1.5}
                      dot={false}
                      activeDot={{ r: 3 }}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-3 flex-wrap mt-2 pl-2">
                {sovData.map(b => (
                  <span key={b.name} className="inline-flex items-center gap-1.5 text-2xs text-brand-muted">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: b.isMe ? MY_BRAND_COLOR : brandColorMap[b.name], boxShadow: brandColorMap[b.name] === '#000000' ? '0 0 0 1px rgba(255,255,255,0.4)' : undefined }} />
                    {b.name}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <p className="section-title mb-0 inline-flex items-center gap-1.5">
              AI Score vs Competitors — <span className="text-brand-text">All LLMs</span>
              <InfoTip text="Visibility = % of analysed AI answers that mention each brand, computed from the run history of every tracked prompt and normalised to the official brand visibility score (the run history is a sample). The second value is the share of that brand's mentions with positive sentiment." />
            </p>
            <button onClick={() => navigate('/competitors')} className="text-xs text-brand-primary flex items-center gap-1 hover:underline">
              Details <ArrowRight size={12} />
            </button>
          </div>
          <CompetitorChart data={sovData} colorMap={brandColorMap} height={214} />
        </div>
      </div>

      {/* Per-LLM competitor charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {LLM_CHARTS.map(({ model, label }) => {
          const rows = statsReady ? toChartRows(brandStats.byModel[model] || []) : null
          return (
            <div key={model} className="card">
              <p className="section-title inline-flex items-center gap-1.5">
                AI Score — <span className="text-brand-text">{label}</span>
                <InfoTip text={`Visibility per brand computed only from ${label} runs: % of ${label} answers that mention each brand, normalised like the All-LLMs chart. Second value = share of mentions with positive sentiment.`} />
              </p>
              {rows === null ? (
                <div className="h-[170px] flex items-center justify-center text-2xs text-brand-dim">loading run history…</div>
              ) : rows.length === 0 ? (
                <div className="h-[170px] flex items-center justify-center text-2xs text-brand-dim">no runs for {label} in this period</div>
              ) : (
                <CompetitorChart data={rows} colorMap={brandColorMap} yWidth={112} />
              )}
            </div>
          )
        })}
      </div>

      {/* Top Priority Action — dark card with lime accents */}
      <div className="card !p-6 relative overflow-hidden" style={{ boxShadow: '0 8px 24px -12px rgba(223,255,17,0.25)' }}>
        {/* Subtle lime glow in top-right corner */}
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-25 pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(223,255,17,0.6) 0%, transparent 70%)' }} />
        {/* Lime accent bar on the left */}
        <div className="absolute left-0 top-6 bottom-6 w-1 rounded-r-full" style={{ backgroundColor: '#DFFF11' }} />
        <div className="flex items-center justify-between gap-4 relative">
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'rgba(223,255,17,0.12)', border: '1px solid rgba(223,255,17,0.30)' }}
            >
              <Zap size={22} strokeWidth={2} style={{ color: '#DFFF11' }} />
            </div>
            <div>
              <p className="section-title mb-1" style={{ color: '#DFFF11' }}>Top Priority Action</p>
              <p className="text-base font-semibold leading-snug text-brand-text max-w-3xl">
                {snap?.aiSuggestions?.[0] ||
                  'Expand content for "best-in-category" fleet queries — competitor dominates 12 prompts where you score 0.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/recommendations')}
            className="flex-shrink-0 flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-full transition-transform hover:scale-105"
            style={{ backgroundColor: '#DFFF11', color: '#0B0F1A' }}
          >
            View all actions <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
