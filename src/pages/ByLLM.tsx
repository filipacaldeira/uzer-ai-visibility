import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend
} from 'recharts'
import { api } from '../api/client'
import { useApi } from '../hooks/useApi'
import { Header } from '../components/layout/Header'
import { ErrorState, PageSkeleton } from '../components/ui/LoadingState'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { llmLabel, llmColor, llmDomain, formatPct, scoreTrend, MY_BRAND_COLOR, brandColor } from '../utils/format'
import { Favicon } from '../components/ui/Favicon'
import { InfoTip } from '../components/ui/InfoTip'

const BRAND_ID = 'c727ae2e-28f3-40f9-8e79-bc83ee402cbb'

const ALL_MODELS = ['gpt-4o-mini', 'gemini-2.5-flash', 'google-ai-mode', 'google-aio']

export default function ByLLM() {
  const [timeRange, setTimeRange] = useState('30d')

  const { data: snap, loading, error, refetch } = useApi(
    () => api.snapshot(BRAND_ID, timeRange), [timeRange]
  )
  const { data: vis } = useApi(
    () => api.visibility(BRAND_ID, timeRange), [timeRange]
  )

  const llmStats = useMemo(() => {
    if (!snap) return []
    const modelMap: Record<string, { mentions: number; totalScore: number; prompts: number }> = {}
    snap.prompts.forEach(p => {
      p.aiModels.forEach(m => {
        if (!modelMap[m]) modelMap[m] = { mentions: 0, totalScore: 0, prompts: 0 }
        modelMap[m].mentions += p.mentions
        modelMap[m].totalScore += p.averageScore
        modelMap[m].prompts++
      })
    })
    return ALL_MODELS.map(m => ({
      id: m,
      label: llmLabel(m),
      color: llmColor(m),
      mentions: modelMap[m]?.mentions || 0,
      avgScore: modelMap[m] ? Math.round(modelMap[m].totalScore / modelMap[m].prompts) : 0,
      prompts: modelMap[m]?.prompts || 0,
      present: !!modelMap[m]?.mentions,
    })).sort((a, b) => b.mentions - a.mentions)
  }, [snap])

  const heatmapData = useMemo(() => {
    if (!snap) return []
    const cats = [...new Set(snap.prompts.map(p => p.category || 'General'))]
    return cats.map(cat => {
      const row: Record<string, unknown> = { category: cat }
      ALL_MODELS.forEach(m => {
        const prompts = snap.prompts.filter(p => (p.category || 'General') === cat && p.aiModels.includes(m))
        row[m] = prompts.length > 0 ? Math.round(prompts.reduce((s, p) => s + p.averageScore, 0) / prompts.length) : 0
      })
      return row
    })
  }, [snap])

  const compData = useMemo(() => {
    if (!snap) return []
    const comp1 = snap.competitors[0]
    const comp2 = snap.competitors[1]
    return ALL_MODELS.map(m => {
      const myPrompts = snap.prompts.filter(p => p.aiModels.includes(m))
      const myScore = myPrompts.length > 0 ? Math.round(myPrompts.reduce((s, p) => s + p.averageScore, 0) / myPrompts.length) : 0
      return {
        llm: llmLabel(m),
        MyForce: myScore,
        ...(comp1 ? { [comp1.name]: Math.round(comp1.score * 0.3) } : {}),
        ...(comp2 ? { [comp2.name]: Math.round(comp2.score * 0.3) } : {}),
      }
    })
  }, [snap])

  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (loading) return <><Header title="Visibility by LLM" timeRange={timeRange} onTimeRangeChange={setTimeRange} /><PageSkeleton /></>

  return (
    <div className="space-y-6">
      <Header
        title="Visibility by LLM"
        subtitle="Performance breakdown by AI platform — % of analysed prompts in which the brand was mentioned by each LLM"
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
      />

      {/* Platform Scorecards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {llmStats.map(llm => (
          <div key={llm.id} className={`card ${llm.present ? '' : 'opacity-60'}`}>
            <div className="flex items-center gap-2 mb-3">
              {llmDomain(llm.id) ? (
                <Favicon domain={llmDomain(llm.id)!} size={14} className={llm.present ? '' : 'opacity-40'} />
              ) : (
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: llm.color }} />
              )}
              <span className="section-title mb-0 inline-flex items-center gap-1.5">
                {llm.label}
                <InfoTip text={`Average visibility score (0–100) that the brand achieves on ${llm.label}, across all tracked prompts.`} />
              </span>
            </div>
            <div className={`text-3xl font-extrabold leading-none ${llm.present ? 'text-brand-text' : 'text-brand-dim'}`}>
              {llm.avgScore}%
            </div>
            <div className="text-2xs text-brand-dim mt-1">avg score</div>
            <div className="mt-3 pt-2 border-t border-brand-border flex justify-between">
              <span className="text-2xs text-brand-muted">{llm.mentions} mentions</span>
              <span className={`text-2xs font-medium ${llm.present ? 'text-brand-success' : 'text-brand-dim'}`}>
                {llm.present ? '✓ Active' : '✗ Absent'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Grouped Bar */}
        <div className="card">
          <p className="section-title inline-flex items-center gap-1.5">
            Brand vs Top Competitors by Platform
            <InfoTip text="Side-by-side comparison of the average visibility score (0–100) per LLM platform, for the brand and its top 2 competitors." />
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={compData} margin={{ left: -10, right: 10 }}>
              <XAxis dataKey="llm" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1A2033', border: '1px solid #2D3654', borderRadius: 8 }}
                labelStyle={{ color: '#FDF8FC' }}
              />
              <Legend iconType="circle" iconSize={8} />
              <Bar dataKey="MyForce" fill={MY_BRAND_COLOR} radius={[3, 3, 0, 0]} maxBarSize={22} />
              {snap?.competitors[0] && <Bar dataKey={snap.competitors[0].name} fill={brandColor(snap.competitors[0].name)} stroke="rgba(255,255,255,0.35)" strokeWidth={brandColor(snap.competitors[0].name) === '#000000' ? 1 : 0} radius={[3, 3, 0, 0]} maxBarSize={22} />}
              {snap?.competitors[1] && <Bar dataKey={snap.competitors[1].name} fill={brandColor(snap.competitors[1].name)} stroke="rgba(255,255,255,0.35)" strokeWidth={brandColor(snap.competitors[1].name) === '#000000' ? 1 : 0} radius={[3, 3, 0, 0]} maxBarSize={22} />}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Heatmap */}
        <div className="card">
          <p className="section-title inline-flex items-center gap-1.5">
            LLM × Category Heatmap
            <InfoTip text="Average visibility score per prompt category on each LLM. Colour tiers: lime ≥ 85 (very high), yellow ≥ 70, orange ≥ 50, dark orange ≥ 30, red-brown &gt; 0." />
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left py-1.5 px-2 text-brand-muted font-medium">Category</th>
                  {ALL_MODELS.map(m => (
                    <th key={m} className="py-1.5 px-2 text-brand-muted font-medium text-center">
                      <div className="flex flex-col items-center gap-1">
                        {llmDomain(m) && <Favicon domain={llmDomain(m)!} size={12} />}
                        <span>{llmLabel(m).split(' ')[0]}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmapData.map((row, i) => (
                  <tr key={i} className="border-t border-brand-border">
                    <td className="py-2 px-2 text-brand-muted">{String(row.category)}</td>
                    {ALL_MODELS.map(m => {
                      const val = Number(row[m]) || 0
                      const bg =
                        val >= 85 ? '#DFFF11' :            // lime           — very high
                        val >= 70 ? 'rgba(250,204,21,0.90)' :  // yellow-400 — high
                        val >= 50 ? 'rgba(249,115,22,0.75)' :  // orange-500 — medium
                        val >= 30 ? 'rgba(234,88,12,0.60)'  :  // orange-600 — low
                        val >  0  ? 'rgba(124,45,18,0.50)'  :  // orange-950 — very low
                        'transparent'
                      const textColor = val > 0 ? '#1F2937' : '#4A5268'
                      return (
                        <td key={m} className="py-2 px-2 text-center">
                          <span className="inline-block w-9 h-6 leading-6 rounded text-xs font-medium" style={{ backgroundColor: bg, color: textColor }}>
                            {val || '—'}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Ranked Table */}
      <div className="card">
        <p className="section-title inline-flex items-center gap-1.5">
          Platform Rankings
          <InfoTip text="LLM platforms ranked by number of mentions. Also shows avg visibility score, mentions count, active prompts, and presence status." />
        </p>
        <table className="w-full">
          <thead>
            <tr className="border-b border-brand-border">
              <th className="th">Platform</th>
              <th className="th">Avg Visibility Score</th>
              <th className="th">Mentions</th>
              <th className="th">Prompts Active</th>
              <th className="th">Status</th>
            </tr>
          </thead>
          <tbody>
            {llmStats.map((llm, i) => (
              <tr key={llm.id} className="table-row">
                <td className="td">
                  <div className="flex items-center gap-2.5">
                    {llmDomain(llm.id) ? (
                      <Favicon domain={llmDomain(llm.id)!} size={14} />
                    ) : (
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: llm.color }} />
                    )}
                    <span className="font-medium">{llm.label}</span>
                  </div>
                </td>
                <td className="td">
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-brand-border rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${llm.avgScore}%`, backgroundColor: llm.color }} />
                    </div>
                    <span>{llm.avgScore}</span>
                  </div>
                </td>
                <td className="td">{llm.mentions}</td>
                <td className="td">{llm.prompts}</td>
                <td className="td">
                  <span className={`badge ${llm.present ? 'bg-brand-success/15 text-brand-success' : 'bg-brand-border text-brand-dim'}`}>
                    {llm.present ? 'Present' : 'Absent'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
