import { Fragment, useState, useMemo, useEffect } from 'react'
import { AlertTriangle, Plus, ArrowUp, ArrowDown, ArrowUpDown, ChevronDown, ChevronRight } from 'lucide-react'
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts'
import { api, type PromptDetail } from '../api/client'
import { useApi } from '../hooks/useApi'
import { Header } from '../components/layout/Header'
import { KPICard } from '../components/ui/KPICard'
import { ErrorState, PageSkeleton } from '../components/ui/LoadingState'
import { truncate, scoreBg } from '../utils/format'
import { InfoTip } from '../components/ui/InfoTip'
import { Favicon } from '../components/ui/Favicon'
import { fetchAllPromptDetails } from '../hooks/useBrandVisibilityStats'

const BRAND_ID = 'c727ae2e-28f3-40f9-8e79-bc83ee402cbb'
const ALL_MODELS = ['gpt-4o-mini', 'gemini-2.5-flash', 'google-ai-mode', 'google-aio']

const TOPICS_KEY = 'prompt-topics-list'
const ASSIGN_KEY = 'prompt-topic-assignments'
const DEFAULT_TOPICS = ['Inspeção', 'Manutenção', 'Pneus', 'Frotas', 'Elétricos']

type SortKey = 'prompt' | 'visibility' | 'sentiment' | 'position' | 'mentions' | 'citations' | 'runs' | 'topic'

interface PromptExtras {
  sentiment: 'positive' | 'neutral' | 'negative' | null
  position: number | null
  citations: number
}

// Aggregate a prompt's run history into sentiment mode, avg position, unique citation count
function aggregateDetail(d: PromptDetail): PromptExtras {
  const mentioned = d.history.filter(r => r.mentioned)
  const counts = { positive: 0, neutral: 0, negative: 0 }
  mentioned.forEach(r => {
    const s = (r.sentiment || '').toLowerCase()
    if (s === 'positive' || s === 'neutral' || s === 'negative') counts[s]++
  })
  const dominant = (Object.entries(counts) as [keyof typeof counts, number][])
    .sort((a, b) => b[1] - a[1])[0]
  const sentiment = dominant && dominant[1] > 0 ? dominant[0] : null

  const ranks = mentioned.map(r => r.rank).filter((r): r is number => typeof r === 'number' && r > 0)
  const position = ranks.length > 0 ? Math.round((ranks.reduce((s, r) => s + r, 0) / ranks.length) * 10) / 10 : null

  const domains = new Set<string>()
  d.history.forEach(r => r.sources.forEach(s => domains.add(s.domain)))

  return { sentiment, position, citations: domains.size }
}

// Treemap tiers (AIX thresholds): High ≥ 70, Medium 40–69, Low < 40
function topicTier(avg: number) {
  if (avg >= 70) return { fill: '#22C55E', text: '#04170B', label: 'High visibility' }
  if (avg >= 40) return { fill: '#F5A623', text: '#1A1F2E', label: 'Medium' }
  return { fill: '#E05252', text: '#FDF8FC', label: 'Low visibility' }
}

function TopicTile(props: any) {
  const { x, y, width, height, name, avg, depth } = props
  if (depth === 0 || width <= 0 || height <= 0) return null
  const tier = name === 'Unassigned' ? { fill: '#3A4663', text: '#C7D0E5' } : topicTier(avg ?? 0)
  const pad = 3
  const showName = width > 42 && height > 24
  const showPct = width > 44 && height > 44
  const nameSize = width > 110 ? 12 : width > 70 ? 10.5 : 9
  const maxChars = Math.max(3, Math.floor((width - 12) / (nameSize * 0.56)))
  const display = (name || '').length > maxChars ? (name || '').slice(0, maxChars - 1) + '…' : name
  return (
    <g>
      <rect x={x + pad} y={y + pad} width={width - pad * 2} height={height - pad * 2} rx={10} fill={tier.fill} stroke="rgba(11,15,26,0.45)" strokeWidth={1.5} />
      {showName && (
        <text x={x + width / 2} y={y + height / 2 - (showPct ? 8 : 0)} textAnchor="middle" dominantBaseline="middle" fontSize={nameSize} fontWeight={600} fill={tier.text}>
          {display}
        </text>
      )}
      {showPct && (
        <text x={x + width / 2} y={y + height / 2 + (showName ? 12 : 0)} textAnchor="middle" dominantBaseline="middle" fontSize={showName ? 15 : 12} fontWeight={800} fill={tier.text}>
          {avg}%
        </text>
      )}
    </g>
  )
}

const SENTIMENT_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  positive: { label: 'Positive', color: '#DFFF11', bg: 'rgba(223,255,17,0.12)' },
  neutral:  { label: 'Neutral',  color: '#9BA8C8', bg: 'rgba(155,168,200,0.12)' },
  negative: { label: 'Negative', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
}

export default function ByPrompt() {
  const [timeRange, setTimeRange] = useState('30d')
  const [topics, setTopics] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(TOPICS_KEY) || '') || DEFAULT_TOPICS } catch { return DEFAULT_TOPICS }
  })
  const [assignments, setAssignments] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(ASSIGN_KEY) || '{}') } catch { return {} }
  })
  const [newTopic, setNewTopic] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('visibility')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => { localStorage.setItem(TOPICS_KEY, JSON.stringify(topics)) }, [topics])
  useEffect(() => { localStorage.setItem(ASSIGN_KEY, JSON.stringify(assignments)) }, [assignments])

  const { data: prompts, loading, error, refetch } = useApi(
    () => api.prompts(BRAND_ID, timeRange), [timeRange]
  )
  const { data: snap } = useApi(
    () => api.snapshot(BRAND_ID, timeRange), [timeRange]
  )
  const { data: comp } = useApi(
    () => api.competitors(BRAND_ID, timeRange), [timeRange]
  )

  // Full run-history details (shared module cache with Overview/Sources)
  const [allDetails, setAllDetails] = useState<PromptDetail[] | null>(null)
  useEffect(() => {
    let alive = true
    setAllDetails(null)
    fetchAllPromptDetails(BRAND_ID, timeRange).then(d => { if (alive) setAllDetails(d) }).catch(() => { if (alive) setAllDetails([]) })
    return () => { alive = false }
  }, [timeRange])

  // Per-prompt extras (sentiment / position / citations) from the detail endpoint,
  // fetched in small batches to avoid hammering the API
  const [extras, setExtras] = useState<Record<string, PromptExtras>>({})
  const [extrasLoading, setExtrasLoading] = useState(false)

  useEffect(() => {
    if (!prompts || prompts.length === 0) return
    let cancelled = false
    setExtras({})
    setExtrasLoading(true)
    const ids = prompts.map(p => p.promptId)
    const BATCH = 16
    ;(async () => {
      for (let i = 0; i < ids.length; i += BATCH) {
        if (cancelled) return
        const batch = ids.slice(i, i + BATCH)
        const results = await Promise.allSettled(
          batch.map(id => api.promptDetail(BRAND_ID, id, timeRange))
        )
        if (cancelled) return
        setExtras(prev => {
          const next = { ...prev }
          results.forEach((r, j) => {
            if (r.status === 'fulfilled') next[batch[j]] = aggregateDetail(r.value)
          })
          return next
        })
      }
      if (!cancelled) setExtrasLoading(false)
    })()
    return () => { cancelled = true }
  }, [prompts, timeRange])

  // Join mentions from snapshot prompts (matched by prompt text)
  const mentionsByText = useMemo(() => {
    const map: Record<string, number> = {}
    ;(snap?.prompts || []).forEach(p => { map[p.promptText] = p.mentions })
    return map
  }, [snap])

  const topPrompts = [...(prompts || [])].sort((a, b) => b.averageScore - a.averageScore).slice(0, 8)
  const bottomPrompts = [...(prompts || [])].filter(p => p.totalRuns > 0).sort((a, b) => a.averageScore - b.averageScore).slice(0, 8)

  const covered = (prompts || []).filter(p => p.averageScore > 0).length
  const total = (prompts || []).length
  const coverageRate = total > 0 ? Math.round((covered / total) * 100) : 0

  const whiteSpace = (prompts || []).filter(p => p.averageScore === 0 && p.totalRuns > 0)

  const topScore = Math.max(...((prompts || []).map(p => p.averageScore).filter(Boolean)), 0)
  const topScoreCount = (prompts || []).filter(p => p.averageScore === topScore && topScore > 0).length

  const winLossData = useMemo(() => {
    if (!snap) return []
    return snap.prompts.slice(0, 8).map(p => {
      const row: Record<string, unknown> = { prompt: truncate(p.promptText, 25) }
      ALL_MODELS.forEach(m => {
        row[m] = p.aiModels.includes(m) ? p.averageScore : 0
      })
      return row
    })
  }, [snap])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'prompt' || key === 'topic' ? 'asc' : 'desc')
    }
  }

  const tableRows = useMemo(() => {
    const SENTIMENT_ORDER: Record<string, number> = { positive: 3, neutral: 2, negative: 1 }
    const rows = (prompts || []).map(p => {
      const ex = extras[p.promptId]
      return {
        id: p.promptId,
        prompt: p.promptText,
        visibility: p.averageScore,
        sentiment: ex?.sentiment ?? null,
        position: ex?.position ?? null,
        mentions: mentionsByText[p.promptText] ?? 0,
        citations: ex?.citations ?? null,
        runs: p.totalRuns,
        trend: p.trend,
        topic: assignments[p.promptId] || '',
      }
    })
    rows.sort((a, b) => {
      let av: number | string, bv: number | string
      switch (sortKey) {
        case 'prompt':     av = a.prompt;     bv = b.prompt; break
        case 'visibility': av = a.visibility; bv = b.visibility; break
        case 'sentiment':  av = a.sentiment ? SENTIMENT_ORDER[a.sentiment] : 0; bv = b.sentiment ? SENTIMENT_ORDER[b.sentiment] : 0; break
        // position: lower rank = better, so invert so "desc" shows best first
        case 'position':   av = a.position != null ? -a.position : -999; bv = b.position != null ? -b.position : -999; break
        case 'mentions':   av = a.mentions;   bv = b.mentions; break
        case 'citations':  av = a.citations ?? -1; bv = b.citations ?? -1; break
        case 'runs':       av = a.runs;       bv = b.runs; break
        case 'topic':      av = a.topic;      bv = b.topic; break
      }
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
    })
    return rows
  }, [prompts, mentionsByText, assignments, extras, sortKey, sortDir])

  const addTopic = () => {
    const t = newTopic.trim()
    if (t && !topics.includes(t)) setTopics([...topics, t])
    setNewTopic('')
  }

  // Average visibility per user-assigned topic
  const topicStats = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {}
    ;(prompts || []).forEach(p => {
      const t = assignments[p.promptId]
      if (!t) return
      if (!map[t]) map[t] = { total: 0, count: 0 }
      map[t].total += p.averageScore
      map[t].count++
    })
    return Object.entries(map)
      .map(([name, v]) => ({ name, avg: Math.round(v.total / v.count), count: v.count }))
      .sort((a, b) => b.avg - a.avg)
  }, [prompts, assignments])

  const unassignedCount = (prompts || []).filter(p => !assignments[p.promptId]).length

  // Topic Rankings: per topic, rank all brands by % of that topic's runs mentioning them
  const topicRankings = useMemo(() => {
    if (!allDetails || topicStats.length === 0) return null
    const compName: Record<string, string> = {}
    const compDomain: Record<string, string> = {}
    comp?.competitors.forEach(c => {
      compName[c.id] = c.name
      try { compDomain[c.id] = new URL(c.url).hostname.replace(/^www\./, '') } catch { /* bad url */ }
    })
    const byId = new Map(allDetails.map(d => [d.promptId, d]))
    return topicStats.map(t => {
      const promptIds = Object.entries(assignments).filter(([, g]) => g === t.name).map(([id]) => id)
      let totalRuns = 0
      const counts: Record<string, number> = {}
      promptIds.forEach(id => {
        const d = byId.get(id)
        ;(d?.history || []).forEach(run => {
          totalRuns++
          const seen = new Set<string>()
          ;(run.brandMentions || []).forEach(m => {
            if (m.type !== 'brand' && m.type !== 'competitor') return
            const key = m.type === 'brand' ? '__brand__' : (m.competitorId || m.entityName)
            if (seen.has(key)) return
            seen.add(key)
            counts[key] = (counts[key] || 0) + 1
          })
        })
      })
      const ranked = Object.entries(counts)
        .map(([key, c]) => ({
          key,
          isMe: key === '__brand__',
          name: key === '__brand__' ? 'MyForce' : (compName[key] || key),
          domain: key === '__brand__' ? 'myforce.pt' : compDomain[key],
          vis: totalRuns > 0 ? Math.round((c / totalRuns) * 100) : 0,
        }))
        .sort((a, b) => b.vis - a.vis)
      const myRank = ranked.findIndex(r => r.isMe) + 1
      const myVis = ranked.find(r => r.isMe)?.vis ?? 0
      const badge = myRank === 1
        ? { label: 'Leading', color: '#22C55E', bg: 'rgba(34,197,94,0.14)' }
        : myRank >= 2 && myRank <= 3
        ? { label: 'Competitive', color: '#F5A623', bg: 'rgba(245,166,35,0.14)' }
        : { label: 'Behind', color: '#E05252', bg: 'rgba(224,82,82,0.14)' }
      return { topic: t.name, badge, top5: ranked.slice(0, 5), myVis, myRank }
    }).sort((a, b) => {
      const order = (r: number) => (r === 1 ? 0 : r >= 2 && r <= 3 ? 1 : 2)
      return order(a.myRank) - order(b.myRank) || b.myVis - a.myVis
    })
  }, [allDetails, topicStats, assignments, comp])

  // Treemap: tile size = number of prompts in the topic; colour/value = MyForce's
  // mention rate in that topic (same metric as Topic Rankings); falls back to the
  // avg score while the run history loads
  const rateByTopic = useMemo(() => {
    const m: Record<string, number> = {}
    ;(topicRankings || []).forEach(r => { m[r.topic] = r.myVis })
    return m
  }, [topicRankings])

  const treemapData = useMemo(() => {
    const tiles: Array<{ name: string; size: number; avg: number }> = topicStats.map(t => ({ name: t.name, size: t.count, avg: rateByTopic[t.name] ?? t.avg }))
    if (unassignedCount > 0) {
      const un = (prompts || []).filter(p => !assignments[p.promptId])
      const avg = un.length > 0 ? Math.round(un.reduce((s, p) => s + p.averageScore, 0) / un.length) : 0
      tiles.push({ name: 'Unassigned', size: unassignedCount, avg })
    }
    return tiles
  }, [topicStats, unassignedCount, prompts, assignments, rateByTopic])

  // Accordion: rows grouped by topic (open by default; click a header to collapse)
  const [closedGroups, setClosedGroups] = useState<Record<string, boolean>>({})
  const groupedRows = useMemo(() => {
    const order = [...topicStats.map(t => t.name), 'Unassigned']
    const map = new Map<string, typeof tableRows>()
    tableRows.forEach(row => {
      const g = row.topic || 'Unassigned'
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(row)
    })
    return order.filter(g => map.has(g)).map(g => ({ group: g, rows: map.get(g)! }))
  }, [tableRows, topicStats])


  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (loading) return <><Header title="Topics | Prompts" timeRange={timeRange} onTimeRangeChange={setTimeRange} /><PageSkeleton /></>

  const SortableTh = ({ k, label, info }: { k: SortKey; label: string; info?: string }) => {
    const active = sortKey === k
    const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown
    return (
      <th className="th">
        <span className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => toggleSort(k)}
            className={`inline-flex items-center gap-1 hover:text-brand-text transition-colors ${active ? 'text-brand-text' : ''}`}
          >
            <span>{label}</span>
            <Icon size={12} className={active ? 'text-brand-primary' : 'opacity-50'} />
          </button>
          {info && <InfoTip text={info} />}
        </span>
      </th>
    )
  }

  return (
    <div className="space-y-6">
      <Header
        title="Topics | Prompts"
        subtitle="Coverage and performance per tracked prompt"
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Prompt Coverage Rate" value={`${coverageRate}%`} deltaDir={coverageRate > 60 ? 'up' : 'down'} subtitle={`${covered}/${total} prompts`} tooltip="Percentage of tracked prompts where the brand appears at least once." />
        <KPICard label="Active Prompts" value={covered} valueSuffix="with brand presence" subtitle={`${total} total prompts`} tooltip="Number of prompts where the brand was mentioned in at least one AI response, out of all tracked prompts." />
        <KPICard label="White Space Gaps" value={whiteSpace.length} deltaDir="down" subtitle="no presence yet" tooltip="Prompts that ran but returned zero brand mentions — opportunities to expand coverage." />
        <KPICard label="Top Prompt Score" value={topScore} subtitle={`${topScoreCount} prompt${topScoreCount === 1 ? '' : 's'} with this score`} tooltip="Highest visibility score (0–100) across all tracked prompts, and how many prompts reach it." />
      </div>

      {/* Visibility by Topic */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="section-title mb-0 inline-flex items-center gap-1.5">
            Visibility by Topic
            <InfoTip text="Per topic: % of that topic's AI answers that mention MyForce (same metric as Topic Rankings). Tile size = number of prompts. Green ≥ 70, amber 40–69, red < 40." />
          </p>
          {unassignedCount > 0 && (
            <span className="text-2xs text-brand-dim">{unassignedCount} prompts unassigned</span>
          )}
        </div>
        {topicStats.length === 0 ? (
          <div className="card !p-5 text-center">
            <p className="text-xs text-brand-muted">Ainda não há prompts classificadas — atribui topics na tabela abaixo para veres a visibilidade média por topic.</p>
          </div>
        ) : (
          <div className="card !p-4">
            <ResponsiveContainer width="100%" height={300}>
              <Treemap
                data={treemapData}
                dataKey="size"
                aspectRatio={4 / 3}
                isAnimationActive={false}
                content={<TopicTile />}
              >
                <Tooltip
                  content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload
                    return (
                      <div style={{ backgroundColor: '#1A2033', border: '1px solid #2D3654', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: '#FDF8FC' }}>
                        <div style={{ fontWeight: 700 }}>{d.name}</div>
                        <div style={{ color: '#9BA8C8', fontSize: 11 }}>MyForce mentioned in {d.avg}% of answers · {d.size} prompt{d.size === 1 ? '' : 's'}</div>
                      </div>
                    )
                  }}
                />
              </Treemap>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 flex-wrap mt-3 pt-3 border-t border-brand-border text-2xs text-brand-muted">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#22C55E' }} />High visibility (≥ 70)</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#F5A623' }} />Medium (40–69)</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#E05252' }} />Low visibility (&lt; 40)</span>
              {unassignedCount > 0 && (
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#3A4663' }} />Unassigned</span>
              )}
              <span className="ml-auto text-brand-dim">Sized by number of prompts · {topicStats.length} topic{topicStats.length === 1 ? '' : 's'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Topic Rankings */}
      {topicStats.length > 0 && (
        <div className="card">
          <p className="section-title inline-flex items-center gap-1.5">
            Topic Rankings
            <InfoTip text="MyForce's visibility ranking vs competitors within each topic: brands ordered by the % of that topic's AI answers mentioning them (top 5 shown). Leading = MyForce #1; Competitive = #2-3; Behind = #4+ or absent." />
            <span className="text-2xs text-brand-dim normal-case tracking-normal font-normal">MyForce's visibility vs competitors by topic</span>
          </p>
          {topicRankings === null ? (
            <div className="py-8 text-center text-2xs text-brand-dim">loading run history…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-brand-border">
                    <th className="th">Topic</th>
                    {[1, 2, 3, 4, 5].map(n => (
                      <th key={n} className="th text-center">#{n}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topicRankings.map(({ topic, badge, top5 }) => (
                    <tr key={topic} className="table-row">
                      <td className="td">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-semibold text-brand-text px-2.5 py-1 rounded-lg bg-brand-elevated border border-brand-border">{topic}</span>
                          <span className="text-2xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: badge.bg, color: badge.color }}>{badge.label}</span>
                        </div>
                      </td>
                      {[0, 1, 2, 3, 4].map(i => {
                        const b = top5[i]
                        return (
                          <td key={i} className="td text-center">
                            {b ? (
                              <span className="relative inline-flex group/rk">
                                <span
                                  className="w-8 h-8 rounded-full inline-flex items-center justify-center"
                                  style={{
                                    backgroundColor: 'rgba(255,255,255,0.06)',
                                    boxShadow: b.isMe ? '0 0 0 2px #EA3624' : '0 0 0 1px rgba(255,255,255,0.12)',
                                  }}
                                >
                                  {b.domain
                                    ? <Favicon domain={b.domain} size={18} />
                                    : <span className="text-2xs font-bold text-brand-muted">{b.name.slice(0, 2)}</span>}
                                </span>
                                <span className="pointer-events-none hidden group-hover/rk:block absolute left-1/2 -translate-x-1/2 top-full mt-1 z-30 whitespace-nowrap px-2 py-1 rounded-md text-2xs text-brand-text border border-brand-border shadow-xl" style={{ backgroundColor: 'rgb(var(--brand-elevated))' }}>
                                  {b.name} · {b.vis}%
                                </span>
                              </span>
                            ) : (
                              <span className="w-8 h-8 rounded-full inline-block" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* All Prompts table */}
      <div className="card">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
          <p className="section-title mb-0 inline-flex items-center gap-1.5">
            All Prompts ({tableRows.length})
            <InfoTip text="Every tracked prompt with visibility, sentiment, average position, mentions, citations and your custom topic classification. Sentiment, position and citations are aggregated from each prompt's run history." />
            {extrasLoading && <span className="text-2xs text-brand-dim normal-case tracking-normal font-normal">loading details…</span>}
          </p>
          {/* Topic manager */}
          <div className="flex items-center gap-2">
            <input
              value={newTopic}
              onChange={e => setNewTopic(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTopic()}
              placeholder="New topic…"
              className="text-xs bg-brand-elevated border border-brand-border rounded-lg px-2.5 py-1.5 text-brand-text placeholder:text-brand-dim focus:outline-none focus:border-brand-primary w-32"
            />
            <button
              onClick={addTopic}
              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-brand-primary/15 text-brand-primary hover:bg-brand-primary/25 transition-colors"
            >
              <Plus size={12} /> Add topic
            </button>
          </div>
        </div>
        {/* ~20 rows visible, internal scroll for the rest */}
        <div className="overflow-x-auto overflow-y-auto max-h-[860px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10" style={{ backgroundColor: 'rgb(var(--brand-card))' }}>
              <tr className="border-b border-brand-border">
                <SortableTh k="prompt" label="Prompt" />
                <SortableTh k="visibility" label="Score" info="Average visibility QUALITY score (0–100) across this prompt's runs: 0 when the brand is absent; higher when it appears earlier and more prominently in the answer. Different from the mention-rate 'visibility' used in Topic Rankings." />
                <SortableTh k="sentiment" label="Sentiment" info="Dominant sentiment of the brand's mentions across this prompt's runs (positive / neutral / negative)." />
                <SortableTh k="position" label="Position" info="Average rank of the brand within AI answers for this prompt. 1 = first brand mentioned." />
                <SortableTh k="mentions" label="Mentions" info="Number of times the brand was mentioned in responses to this prompt." />
                <SortableTh k="citations" label="Citations" info="Number of unique source domains cited by the AI in responses to this prompt." />
                <SortableTh k="runs" label="Runs" info="Total times this prompt was executed in the period." />
                <SortableTh k="topic" label="Topic" info="Your own classification. Assign each prompt to a topic; add new topics with the field above. Stored locally in this browser." />
              </tr>
            </thead>
            <tbody>
              {groupedRows.map(({ group, rows }) => {
                const isOpen = !closedGroups[group]
                const gAvg = Math.round(rows.reduce((s, r) => s + r.visibility, 0) / Math.max(rows.length, 1))
                const gTier = group === 'Unassigned' ? { fill: '#3A4663', text: '#C7D0E5' } : topicTier(gAvg)
                return (
                <Fragment key={group}>
                <tr
                  className="cursor-pointer hover:bg-brand-elevated/40 border-b border-brand-border"
                  style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
                  onClick={() => setClosedGroups(prev => ({ ...prev, [group]: !prev[group] }))}
                >
                  <td colSpan={8} className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      {isOpen ? <ChevronDown size={14} className="text-brand-muted" /> : <ChevronRight size={14} className="text-brand-dim" />}
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#06B6D4' }}>{group}</span>
                      <span className="text-2xs text-brand-dim">{rows.length} prompt{rows.length === 1 ? '' : 's'}</span>
                      <span className="text-2xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: gTier.fill, color: gTier.text }}>
                        {gAvg} avg score
                      </span>
                    </div>
                  </td>
                </tr>
                {isOpen && rows.map(row => {
                const loaded = row.id in extras
                const sStyle = row.sentiment ? SENTIMENT_STYLE[row.sentiment] : null
                return (
                <tr key={row.id} className="table-row">
                  <td className="td max-w-[22rem]">
                    <span className="relative block group/prompt">
                      <span className="block truncate">{row.prompt}</span>
                      <span className="pointer-events-none hidden group-hover/prompt:block absolute left-0 top-full mt-1 z-30 w-[26rem] max-w-[80vw] p-3 rounded-lg text-xs leading-relaxed text-brand-text whitespace-normal shadow-xl border border-brand-border" style={{ backgroundColor: 'rgb(var(--brand-elevated))' }}>
                        {row.prompt}
                      </span>
                    </span>
                  </td>
                  <td className="td">
                    <span className={`badge ${scoreBg(row.visibility)} min-w-[2.5rem] text-center inline-block`}>{row.visibility}</span>
                  </td>
                  <td className="td">
                    {sStyle ? (
                      <span className="badge text-2xs" style={{ backgroundColor: sStyle.bg, color: sStyle.color }}>{sStyle.label}</span>
                    ) : (
                      <span className="text-brand-dim">{loaded ? '—' : '…'}</span>
                    )}
                  </td>
                  <td className="td tabular-nums">
                    {row.position != null ? `#${row.position}` : <span className="text-brand-dim">{loaded ? '—' : '…'}</span>}
                  </td>
                  <td className="td tabular-nums">{row.mentions || '—'}</td>
                  <td className="td tabular-nums">
                    {row.citations != null ? (row.citations || '—') : <span className="text-brand-dim">…</span>}
                  </td>
                  <td className="td tabular-nums">{row.runs}</td>
                  <td className="td">
                    <select
                      value={row.topic}
                      onChange={e => setAssignments(prev => ({ ...prev, [row.id]: e.target.value }))}
                      className={`text-xs bg-brand-elevated border rounded-lg px-2 py-1 cursor-pointer focus:outline-none focus:border-brand-primary ${row.topic ? 'border-brand-primary/40 text-brand-text' : 'border-brand-border text-brand-dim'}`}
                    >
                      <option value="">— unassigned —</option>
                      {topics.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                </tr>
                )})}
                </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* White Space Gaps */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={14} className="text-brand-warning" />
          <p className="section-title mb-0 inline-flex items-center gap-1.5">
            White Space Gaps
            <InfoTip text="Prompts that ran but the brand scored 0 — priority opportunities to close." />
          </p>
        </div>
        {whiteSpace.length === 0 ? (
          <p className="text-xs text-brand-muted">No white space gaps detected.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            {whiteSpace.slice(0, 8).map(p => (
              <div key={p.promptId} className="p-2.5 rounded-lg bg-brand-elevated border border-brand-warning/20">
                <p className="text-xs text-brand-text mb-1">{truncate(p.promptText, 60)}</p>
                <span className="text-2xs text-brand-warning">{p.totalRuns} runs, 0 score</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top / Bottom Prompts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card">
          <p className="section-title inline-flex items-center gap-1.5">
            Top Performing Prompts
            <InfoTip text="Prompts where the brand has the highest average visibility score across all LLMs." />
          </p>
          <div className="space-y-2">
            {topPrompts.filter(p => p.averageScore > 0).map(p => (
              <div key={p.promptId} className="flex items-start gap-3 p-2 rounded-lg hover:bg-brand-elevated transition-colors">
                <span className={`badge ${scoreBg(p.averageScore)} min-w-[2.5rem] text-center mt-0.5`}>{p.averageScore}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-brand-text line-clamp-2">{p.promptText}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    {assignments[p.promptId] && (
                      <span className="badge bg-brand-primary/15 text-brand-primary text-2xs">{assignments[p.promptId]}</span>
                    )}
                    <span className="text-2xs text-brand-dim">{p.totalRuns} runs</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <p className="section-title inline-flex items-center gap-1.5">
            Low Performance Prompts
            <InfoTip text="Prompts with the lowest visibility score where at least one AI response was analysed." />
          </p>
          <div className="space-y-2">
            {bottomPrompts.map(p => (
              <div key={p.promptId} className="flex items-start gap-3 p-2 rounded-lg hover:bg-brand-elevated transition-colors">
                <span className={`badge ${scoreBg(p.averageScore)} min-w-[2.5rem] text-center mt-0.5`}>{p.averageScore}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-brand-text line-clamp-2">{p.promptText}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    {assignments[p.promptId] && (
                      <span className="badge bg-brand-primary/15 text-brand-primary text-2xs">{assignments[p.promptId]}</span>
                    )}
                    <span className="text-2xs text-brand-dim">{p.totalRuns} runs</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Win/Loss Grid */}
      <div className="card">
        <p className="section-title inline-flex items-center gap-1.5">
          Win/Loss Grid — Prompts × Platforms
          <InfoTip text="Matrix of prompts × AI platforms. Cell value = visibility score for that combination; empty = platform did not run this prompt." />
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-brand-border">
                <th className="text-left py-2 px-3 text-brand-muted font-medium w-56">Prompt</th>
                {ALL_MODELS.map(m => (
                  <th key={m} className="py-2 px-3 text-center text-brand-muted font-medium">{
                    m === 'gpt-4o-mini' ? 'ChatGPT' :
                    m === 'gemini-2.5-flash' ? 'Gemini' :
                    m === 'google-ai-mode' ? 'AI Mode' : 'AIO'
                  }</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {winLossData.map((row, i) => (
                <tr key={i} className="border-b border-brand-border/50 hover:bg-brand-elevated/30">
                  <td className="py-2 px-3 text-brand-muted max-w-[14rem]">
                    <span className="block truncate cursor-help" title={String(row.prompt)}>{String(row.prompt)}</span>
                  </td>
                  {ALL_MODELS.map(m => {
                    const val = Number(row[m])
                    const bg = val > 60 ? 'rgba(34,197,94,0.25)' : val > 30 ? 'rgba(245,158,11,0.2)' : val > 0 ? 'rgba(239,68,68,0.15)' : 'transparent'
                    return (
                      <td key={m} className="py-2 px-3 text-center">
                        <span className="inline-block w-10 h-6 leading-6 rounded text-xs font-medium" style={{ backgroundColor: bg, color: val > 0 ? '#FDF8FC' : '#4A5268' }}>
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
  )
}
