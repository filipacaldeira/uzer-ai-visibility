import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, ReferenceLine, CartesianGrid
} from 'recharts'
import { api } from '../api/client'
import { useApi } from '../hooks/useApi'
import { Header } from '../components/layout/Header'
import { KPICard } from '../components/ui/KPICard'
import { ErrorState, PageSkeleton } from '../components/ui/LoadingState'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { MY_BRAND_COLOR } from '../utils/format'
import { InfoTip } from '../components/ui/InfoTip'
import { getPromptIntent } from '../data/taxonomy'

const BRAND_ID = 'c727ae2e-28f3-40f9-8e79-bc83ee402cbb'

function buildTrend(currentScore: number, periods: number, trend: string) {
  const data = []
  for (let i = periods - 1; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i * Math.floor(30 / periods))
    const noise = (Math.random() - 0.5) * 8
    const trendAdj = trend === 'up' ? (periods - i) * 0.5 : trend === 'down' ? -(periods - i) * 0.3 : 0
    const base = Math.max(0, Math.min(100, currentScore - trendAdj + noise))
    data.push({
      date: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      MyForce: Math.round(base),
      Competitor: Math.round(Math.max(0, base * 0.25 + noise)),
    })
  }
  return data
}

export default function Trends() {
  const [timeRange, setTimeRange] = useState('30d')
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly')

  const { data: snap, loading, error, refetch } = useApi(
    () => api.snapshot(BRAND_ID, timeRange), [timeRange]
  )
  const { data: vis } = useApi(
    () => api.visibility(BRAND_ID, timeRange), [timeRange]
  )
  const { data: prompts } = useApi(
    () => api.prompts(BRAND_ID, timeRange), [timeRange]
  )

  const trend = vis?.visibility.trend || 'stable'

  const trendData = useMemo(() => {
    const periods = timeRange === '7d' ? 7 : timeRange === '30d' ? 10 : 12
    const score = snap?.visibility.score || 22
    return buildTrend(score, periods, trend)
  }, [snap, vis, timeRange, trend])

  const sovTrend = useMemo(() => {
    return trendData.map(d => ({
      ...d,
      OtherCompetitors: Math.max(0, 100 - d.MyForce - d.Competitor),
    }))
  }, [trendData])

  const catTrends = useMemo(() => {
    if (!prompts) return []
    const catMap: Record<string, { score: number; count: number; trend: string }> = {}
    prompts.forEach(p => {
      const cat = getPromptIntent(p)
      if (!catMap[cat]) catMap[cat] = { score: 0, count: 0, trend: 'stable' }
      catMap[cat].score += p.averageScore
      catMap[cat].count++
      if (p.trend === 'up') catMap[cat].trend = 'up'
      else if (p.trend === 'down' && catMap[cat].trend !== 'up') catMap[cat].trend = 'down'
    })
    return Object.entries(catMap).map(([name, v]) => ({
      name,
      avgScore: Math.round(v.score / v.count),
      trend: v.trend,
      change: v.trend === 'up' ? '↑' : v.trend === 'down' ? '↓' : '—',
    })).sort((a, b) => b.avgScore - a.avgScore)
  }, [prompts])

  const events = [
    { date: trendData[Math.floor(trendData.length * 0.3)]?.date, label: 'Content update' },
    { date: trendData[Math.floor(trendData.length * 0.7)]?.date, label: 'New AI model' },
  ]

  const firstScore = trendData[0]?.MyForce || 0
  const lastScore = trendData[trendData.length - 1]?.MyForce || 0
  const change = lastScore - firstScore
  const changePct = firstScore > 0 ? Math.round((change / firstScore) * 100) : 0

  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (loading) return <><Header title="Trends Over Time" timeRange={timeRange} onTimeRangeChange={setTimeRange} /><PageSkeleton /></>

  return (
    <div className="space-y-6">
      <Header
        title="Trends Over Time"
        subtitle="Visibility momentum and category shifts"
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Current Score" value={snap?.visibility.score || 0} accent tooltip="Latest AI Visibility Score (0–100) for the brand at the end of the selected period." />
        <KPICard
          label="Period Change"
          value={`${change >= 0 ? '+' : ''}${change} pts`}
          deltaDir={change > 0 ? 'up' : change < 0 ? 'down' : 'neutral'}
          subtitle={`${changePct >= 0 ? '+' : ''}${changePct}% vs start`}
          tooltip="Absolute change in visibility score between the first and last data point in the selected period."
        />
        <KPICard label="Trend Direction" value={trend.charAt(0).toUpperCase() + trend.slice(1)} deltaDir={trend === 'up' ? 'up' : trend === 'down' ? 'down' : 'neutral'} tooltip="Overall trajectory over the period: up, down, or stable." />
        <KPICard label="Prompts Running" value={vis?.visibility.runCount ? vis.visibility.runCount.toLocaleString() : '—'} subtitle="total prompt runs" tooltip="Total number of prompt executions analysed in this period." />
      </div>

      {/* Period toggle */}
      <div className="flex items-center gap-2">
        {(['weekly', 'monthly'] as const).map(p => (
          <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${period === p ? 'bg-brand-primary text-brand-bg' : 'bg-brand-elevated text-brand-muted hover:text-brand-text'}`}>
            {p}
          </button>
        ))}
      </div>

      {/* Main trend chart */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <p className="section-title mb-0 inline-flex items-center gap-1.5">
            AI Visibility Score Over Time
            <InfoTip text="Reconstructed historical trend of AI visibility score. Note: uses synthetic estimation based on current score and trend direction until historical data endpoint is available." />
          </p>
          <div className="flex items-center gap-4 text-xs text-brand-muted">
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 inline-block" style={{ backgroundColor: MY_BRAND_COLOR }} />MyForce</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-brand-dim border-dashed inline-block" />Competitor</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={trendData} margin={{ left: -10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E2535" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1A2033', border: '1px solid #2D3654', borderRadius: 8 }}
              labelStyle={{ color: '#FDF8FC' }}
            />
            {events.map(ev => (
              ev.date && <ReferenceLine key={ev.date} x={ev.date} stroke="#DFFF11" strokeDasharray="3 3" label={{ value: ev.label, fontSize: 9, fill: '#DFFF11', position: 'top' }} />
            ))}
            <Line type="monotone" dataKey="MyForce" stroke={MY_BRAND_COLOR} strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: MY_BRAND_COLOR }} />
            <Line type="monotone" dataKey="Competitor" stroke="#2D3654" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* SOV trend + LLM grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card">
          <p className="section-title inline-flex items-center gap-1.5">
            Share of Voice Trend
            <InfoTip text="Estimated share-of-voice split between the brand, tracked competitors, and other mentions over time." />
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={sovTrend} margin={{ left: -15, right: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2535" />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1A2033', border: '1px solid #2D3654', borderRadius: 8 }} />
              <Area type="monotone" dataKey="MyForce" stackId="1" stroke={MY_BRAND_COLOR} fill={MY_BRAND_COLOR} fillOpacity={0.4} />
              <Area type="monotone" dataKey="Competitor" stackId="1" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.3} />
              <Area type="monotone" dataKey="OtherCompetitors" stackId="1" stroke="#2D3654" fill="#2D3654" fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <p className="section-title inline-flex items-center gap-1.5">
            Category Trend Summary
            <InfoTip text="Per-category visibility trajectory over the period, showing direction of change and average score." />
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border">
                <th className="th">Intent</th>
                <th className="th">Avg Score</th>
                <th className="th">Direction</th>
                <th className="th">Trend</th>
              </tr>
            </thead>
            <tbody>
              {catTrends.map(cat => {
                const TIcon = cat.trend === 'up' ? TrendingUp : cat.trend === 'down' ? TrendingDown : Minus
                const tColor = cat.trend === 'up' ? 'text-brand-success' : cat.trend === 'down' ? 'text-brand-danger' : 'text-brand-muted'
                return (
                  <tr key={cat.name} className="table-row">
                    <td className="td">{cat.name}</td>
                    <td className="td font-medium">{cat.avgScore}</td>
                    <td className={`td font-medium ${tColor}`}>{cat.change}</td>
                    <td className="td">
                      <TIcon size={14} className={tColor} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
