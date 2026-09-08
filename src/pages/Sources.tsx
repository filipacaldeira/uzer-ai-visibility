import { useState, useMemo, useEffect } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { AlertTriangle, ArrowUp, ArrowDown, ArrowUpDown, Search } from 'lucide-react'
import { api } from '../api/client'
import { useApi } from '../hooks/useApi'
import { Header } from '../components/layout/Header'
import { ErrorState, PageSkeleton } from '../components/ui/LoadingState'
import { Favicon } from '../components/ui/Favicon'
import { InfoTip } from '../components/ui/InfoTip'
import { llmDomain, llmLabel, llmColor } from '../utils/format'
import { fetchAllPromptDetails } from '../hooks/useBrandVisibilityStats'

const BRAND_ID = 'c727ae2e-28f3-40f9-8e79-bc83ee402cbb'

const OWNED_DOMAINS = new Set(['myforce.pt'])
const DA_MAP: Record<string, number> = {
  'youtube.com': 99, 'google.com': 100, 'facebook.com': 96, 'reddit.com': 91,
  'instagram.com': 93, 'myforce.pt': 35, 'midas.pt': 42, 'euromaster.pt': 40,
  'feuvert.pt': 38, 'boschcarservice.com': 60, 'acp.pt': 55, 'norauto.pt': 39,
  'caetano.pt': 48, 'carmine.pt': 28, 'auto.pt': 35, 'controlauto.pt': 30,
  'ayvens.com': 52, 'wialon.com': 44, 'prio.pt': 40, 'carglass.pt': 45,
}
const TYPE_MAP: Record<string, string> = {
  'youtube.com': 'social', 'google.com': 'search', 'facebook.com': 'social',
  'reddit.com': 'community', 'instagram.com': 'social', 'myforce.pt': 'owned',
  'acp.pt': 'directory', 'caetano.pt': 'automotive',
  'controlauto.pt': 'automotive', 'wialon.com': 'fleet', 'prio.pt': 'fuel',
  'carglass.pt': 'automotive', 'carmine.pt': 'owned',
}
const TYPE_COLORS: Record<string, string> = {
  'owned': '#06B6D4', 'competitor': '#F59E0B', 'social': '#8B5CF6', 'search': '#4285F4',
  'community': '#EC4899', 'automotive': '#DFFF11',
  'directory': '#F472B6', 'fleet': '#14B8A6', 'fuel': '#F97316',
}

type SourceClass = 'owned' | 'competitor' | 'earned'

const CLASS_META: Record<SourceClass, { label: string; color: string }> = {
  owned:      { label: 'Owned',      color: '#06B6D4' },
  competitor: { label: 'Competitor', color: '#F59E0B' },
  earned:     { label: 'Earned',     color: '#8B5CF6' },
}

// Preferred column order for the citations matrix; extras get appended
const MODEL_ORDER = ['gpt-4o-mini', 'gemini-2.5-flash', 'sonar', 'perplexity', 'google-aio', 'google-ai-mode']

export default function Sources() {
  const [timeRange, setTimeRange] = useState('30d')
  const [sortKey, setSortKey] = useState<'domain' | 'type' | 'mentions' | 'share' | 'da' | 'platforms' | 'owned'>('mentions')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [domainSearch, setDomainSearch] = useState('')

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'domain' || key === 'type' ? 'asc' : 'desc')
    }
  }

  const { data: sources, loading, error, refetch } = useApi(
    () => api.sources(BRAND_ID, timeRange), [timeRange]
  )
  const { data: comp } = useApi(
    () => api.competitors(BRAND_ID, timeRange), [timeRange]
  )

  // Competitor hostnames derived from the tracked competitors' URLs, so new
  // competitors added in Peekaboo are classified automatically
  const competitorHosts = useMemo(() => {
    const set = new Set<string>()
    comp?.competitors.forEach(c => {
      try { set.add(new URL(c.url).hostname.replace(/^www\./, '')) } catch { /* bad url */ }
    })
    return set
  }, [comp])

  const classify = (domain: string): SourceClass =>
    OWNED_DOMAINS.has(domain) ? 'owned' : competitorHosts.has(domain) ? 'competitor' : 'earned'

  const enriched = useMemo(() => {
    if (!sources) return []
    return sources.sources.map(s => {
      const cls = classify(s.domain)
      return {
        ...s,
        cls,
        da: DA_MAP[s.domain] || 40,
        type: cls === 'competitor' ? 'competitor' : (TYPE_MAP[s.domain] || 'other'),
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources, competitorHosts])

  const totalMentions = enriched.reduce((s, x) => s + x.mentions, 0)
  const classMentions = (cls: SourceClass) => enriched.filter(s => s.cls === cls).reduce((s, x) => s + x.mentions, 0)

  const donutData = (['owned', 'earned', 'competitor'] as SourceClass[]).map(cls => ({
    name: CLASS_META[cls].label,
    value: classMentions(cls),
    color: CLASS_META[cls].color,
  }))

  const top5 = enriched.slice(0, 5)
  const top5Mentions = top5.reduce((s, d) => s + d.mentions, 0)
  const concentrationRisk = totalMentions > 0 ? Math.round((top5Mentions / totalMentions) * 100) : 0
  const highRisk = concentrationRisk > 60

  const typeBreakdown = useMemo(() => {
    const map: Record<string, number> = {}
    enriched.forEach(s => { map[s.type] = (map[s.type] || 0) + s.mentions })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([type, count]) => ({ type, count }))
  }, [enriched])

  const sortedRows = useMemo(() => {
    const clsRank: Record<SourceClass, number> = { owned: 2, competitor: 1, earned: 0 }
    const arr = [...enriched]
    arr.sort((a, b) => {
      let av: number | string = 0, bv: number | string = 0
      switch (sortKey) {
        case 'domain':    av = a.domain;            bv = b.domain; break
        case 'type':      av = a.type;              bv = b.type; break
        case 'mentions':
        case 'share':     av = a.mentions;          bv = b.mentions; break
        case 'da':        av = a.da;                bv = b.da; break
        case 'platforms': av = a.aiModels.length;   bv = b.aiModels.length; break
        case 'owned':     av = clsRank[a.cls];      bv = clsRank[b.cls]; break
      }
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
    })
    return arr.slice(0, 15)
  }, [enriched, sortKey, sortDir])

  // ── Real per-model citation counts from the run history sample ────────────
  const [modelCitations, setModelCitations] = useState<Record<string, Record<string, number>> | null>(null)

  useEffect(() => {
    let alive = true
    setModelCitations(null)
    fetchAllPromptDetails(BRAND_ID, timeRange).then(details => {
      if (!alive) return
      const map: Record<string, Record<string, number>> = {}
      details.forEach(d => {
        ;(d.history || []).forEach(run => {
          const model = run.aiModel || 'unknown'
          ;(run.sources || []).forEach(src => {
            const dom = (src.domain || '').replace(/^www\./, '')
            if (!dom) return
            if (!map[model]) map[model] = {}
            map[model][dom] = (map[model][dom] || 0) + 1
          })
        })
      })
      setModelCitations(map)
    }).catch(() => { if (alive) setModelCitations({}) })
    return () => { alive = false }
  }, [timeRange])

  const modelsPresent = useMemo(() => {
    if (!modelCitations) return []
    const present = Object.keys(modelCitations)
    return [...MODEL_ORDER.filter(m => present.includes(m)), ...present.filter(m => !MODEL_ORDER.includes(m))]
  }, [modelCitations])

  // Top 3 sources per LLM (leaderboard cards)
  const top3ByModel = useMemo(() => {
    if (!modelCitations) return null
    const out: Record<string, Array<{ domain: string; count: number }>> = {}
    modelsPresent.forEach(m => {
      out[m] = Object.entries(modelCitations[m] || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([domain, count]) => ({ domain, count }))
    })
    return out
  }, [modelCitations, modelsPresent])

  // Matrix rows: domains sorted by total citations across models
  const matrixRows = useMemo(() => {
    if (!modelCitations) return []
    const totals: Record<string, number> = {}
    Object.values(modelCitations).forEach(byDomain => {
      Object.entries(byDomain).forEach(([d, c]) => { totals[d] = (totals[d] || 0) + c })
    })
    const q = domainSearch.trim().toLowerCase()
    return Object.entries(totals)
      .filter(([d]) => !q || d.toLowerCase().includes(q))
      .sort((a, b) => b[1] - a[1])
      .map(([domain, total]) => ({ domain, total }))
  }, [modelCitations, domainSearch])

  const columnMax = useMemo(() => {
    const max: Record<string, number> = {}
    modelsPresent.forEach(m => {
      max[m] = Math.max(1, ...Object.values(modelCitations?.[m] || { x: 1 }))
    })
    return max
  }, [modelCitations, modelsPresent])

  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (loading) return <><Header title="Source & Citation Footprint" timeRange={timeRange} onTimeRangeChange={setTimeRange} /><PageSkeleton /></>

  return (
    <div className="space-y-6">
      <Header
        title="Source & Citation Footprint"
        subtitle="Content and domain authority driving your AI visibility"
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
      />

      {/* Row 1: Donut + Type Breakdown + Concentration */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card flex flex-col items-center">
          <p className="section-title self-start inline-flex items-center gap-1.5">
            Owned · Earned · Competitor
            <InfoTip text="Split of total citations: Owned = brand-controlled domains; Competitor = tracked competitors' own websites (derived from their URLs); Earned = every other third-party domain." />
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={donutData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={3} stroke="none">
                {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1A2033', border: '1px solid #2D3654', borderRadius: 8 }} formatter={(v) => [`${v} citations`, '']} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 text-xs flex-wrap justify-center">
            {donutData.map(d => (
              <span key={d.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-brand-muted">{d.name}: <strong className="text-brand-text">{totalMentions > 0 ? Math.round((d.value / totalMentions) * 100) : 0}%</strong></span>
              </span>
            ))}
          </div>
        </div>

        <div className="card">
          <p className="section-title inline-flex items-center gap-1.5">
            Source Type Breakdown
            <InfoTip text="Distribution of citations by source type: search results, social media, community/forum, competitor sites, directory, or other." />
          </p>
          <div className="space-y-2">
            {typeBreakdown.map(({ type, count }) => {
              const pct = totalMentions > 0 ? Math.round((count / totalMentions) * 100) : 0
              return (
                <div key={type} className="flex items-center gap-3">
                  <span className="text-xs text-brand-muted w-20 capitalize">{type}</span>
                  <div className="flex-1 h-1.5 bg-brand-border rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: TYPE_COLORS[type] || '#8B93A9' }} />
                  </div>
                  <span className="text-xs text-brand-muted w-8 text-right">{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className={`card ${highRisk ? 'border-brand-danger/30 bg-brand-danger/5' : 'border-brand-success/20 bg-brand-success/5'}`}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className={highRisk ? 'text-brand-danger' : 'text-brand-success'} />
            <p className="section-title mb-0 inline-flex items-center gap-1.5">
              Concentration Risk
              <InfoTip text="Share of citations coming from the top 5 domains. Above 60% is considered high risk — a change in any of those sources may impact visibility significantly." />
            </p>
          </div>
          <div className="text-4xl font-bold mb-1" style={{ color: highRisk ? '#EF4444' : '#DFFF11' }}>{concentrationRisk}%</div>
          <p className="text-xs text-brand-muted mb-3">of citations from top 5 sources</p>
          <div className="space-y-1">
            {top5.map(s => (
              <div key={s.domain} className="flex justify-between text-xs items-center">
                <span className="flex items-center gap-1.5 text-brand-muted">
                  <Favicon domain={s.domain} size={12} />
                  {s.domain}
                </span>
                <span className="text-brand-text">{Math.round((s.mentions / totalMentions) * 100)}%</span>
              </div>
            ))}
          </div>
          {highRisk && <p className="text-xs text-brand-danger mt-3 pt-3 border-t border-brand-danger/20">⚠ High risk — diversify citation sources</p>}
        </div>
      </div>

      {/* Top 3 sources per LLM */}
      <div>
        <p className="section-title inline-flex items-center gap-1.5">
          Top Sources by LLM
          <InfoTip text="The 3 most-cited domains in each AI platform's answers, counted from the real run history of every tracked prompt (sample-based)." />
        </p>
        {top3ByModel === null ? (
          <div className="card !p-5 text-center text-2xs text-brand-dim">loading run history…</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {modelsPresent.map(m => (
              <div key={m} className="card !p-4">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-brand-border">
                  {llmDomain(m) && <Favicon domain={llmDomain(m)!} size={14} />}
                  <span className="text-xs font-semibold text-brand-text">{llmLabel(m)}</span>
                </div>
                <div className="space-y-2">
                  {(top3ByModel[m] || []).map((s, i) => {
                    const cls = classify(s.domain)
                    return (
                      <div key={s.domain} className="flex items-center gap-2">
                        <span className="text-2xs font-bold w-4 text-brand-dim">#{i + 1}</span>
                        <Favicon domain={s.domain} size={13} />
                        <span className="text-xs text-brand-text truncate flex-1" title={s.domain}>{s.domain}</span>
                        <span className="text-2xs font-bold tabular-nums" style={{ color: CLASS_META[cls].color }}>{s.count}</span>
                      </div>
                    )
                  })}
                  {(top3ByModel[m] || []).length === 0 && (
                    <p className="text-2xs text-brand-dim">no citations in sample</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top Cited Domains table */}
      <div className="card">
        <p className="section-title mb-1 inline-flex items-center gap-1.5">
          Top Cited Domains
          <InfoTip text="Ranked domains by citation count. Click a column header to sort. Type includes 'competitor' for tracked competitors' own sites." />
        </p>
        <p className="text-2xs text-brand-dim mb-2">Official Peekaboo count — each domain counts once per AI answer, no matter how many of its links the answer cites</p>
        <table className="w-full">
          <thead>
            <tr className="border-b border-brand-border">
              {([
                { key: 'domain',    label: 'Domain' },
                { key: 'type',      label: 'Type' },
                { key: 'mentions',  label: 'Citations' },
                { key: 'share',     label: 'Share' },
                { key: 'da',        label: 'Domain Authority' },
                { key: 'platforms', label: 'AI Platforms' },
                { key: 'owned',     label: 'Class' },
              ] as const).map(col => {
                const active = sortKey === col.key
                const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown
                return (
                  <th key={col.key} className="th">
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className={`inline-flex items-center gap-1 hover:text-brand-text transition-colors ${active ? 'text-brand-text' : ''}`}
                    >
                      <span>{col.label}</span>
                      <Icon size={12} className={active ? 'text-brand-primary' : 'opacity-50'} />
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((src, i) => (
              <tr key={src.domain} className="table-row">
                <td className="td font-medium">
                  <div className="flex items-center gap-2">
                    <span className="text-brand-dim text-xs w-5">{i + 1}</span>
                    <Favicon domain={src.domain} size={14} />
                    {src.domain}
                  </div>
                </td>
                <td className="td">
                  <span className="badge text-xs capitalize" style={{ backgroundColor: (TYPE_COLORS[src.type] || '#8B93A9') + '20', color: TYPE_COLORS[src.type] || '#8B93A9' }}>
                    {src.type}
                  </span>
                </td>
                <td className="td tabular-nums">{src.mentions}</td>
                <td className="td tabular-nums text-brand-muted">{Math.round((src.mentions / totalMentions) * 100)}%</td>
                <td className="td">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1 bg-brand-border rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${src.da}%`, backgroundColor: src.da > 70 ? '#DFFF11' : src.da > 40 ? '#F59E0B' : '#EF4444' }} />
                    </div>
                    <span className="text-xs">{src.da}</span>
                  </div>
                </td>
                <td className="td">
                  <div className="flex gap-1.5 flex-wrap items-center">
                    {src.aiModels.slice(0, 4).map((m: string) => {
                      const domain = llmDomain(m)
                      return domain ? (
                        <Favicon key={m} domain={domain} size={13} />
                      ) : null
                    })}
                  </div>
                </td>
                <td className="td">
                  <span className="text-xs font-medium" style={{ color: CLASS_META[src.cls].color }}>
                    {src.cls === 'owned' ? '✓ ' : ''}{CLASS_META[src.cls].label}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Domain Citations by AI Model */}
      <div className="card">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
          <div>
            <p className="section-title mb-1 inline-flex items-center gap-1.5">
              Domain Citations by AI Model
              <InfoTip text="How often each domain is cited per AI platform, counted from the real run history of every tracked prompt (sample-based). Cell colour intensity is relative to each platform's own maximum." />
            </p>
            <p className="text-2xs text-brand-dim">Every cited link counts — if one answer cites 4 pages of a domain, it counts 4. Larger numbers than the table above by design</p>
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-dim" />
            <input
              value={domainSearch}
              onChange={e => setDomainSearch(e.target.value)}
              placeholder="Search domains…"
              className="text-xs bg-brand-elevated border border-brand-border rounded-lg pl-8 pr-3 py-1.5 text-brand-text placeholder:text-brand-dim focus:outline-none focus:border-brand-primary w-48"
            />
          </div>
        </div>
        {modelCitations === null ? (
          <div className="py-10 text-center text-2xs text-brand-dim">loading run history…</div>
        ) : matrixRows.length === 0 ? (
          <div className="py-10 text-center text-2xs text-brand-dim">no domains match “{domainSearch}”</div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-[560px] mt-3">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10" style={{ backgroundColor: 'rgb(var(--brand-card))' }}>
                <tr>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-brand-muted border-b border-brand-border" style={{ minWidth: 170 }}>Domain</th>
                  {modelsPresent.map(m => (
                    <th key={m} className="py-2.5 px-2 border-b border-brand-border" style={{ minWidth: 96 }}>
                      <div className="flex items-center justify-center gap-1.5">
                        {llmDomain(m) && <Favicon domain={llmDomain(m)!} size={13} />}
                        <span className="text-xs font-semibold" style={{ color: llmColor(m) }}>{llmLabel(m)}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixRows.slice(0, 40).map(({ domain }) => (
                  <tr key={domain} className="border-b border-brand-border/40">
                    <td className="py-1.5 px-3">
                      <div className="flex items-center gap-2">
                        <Favicon domain={domain} size={13} />
                        <span className="text-xs text-brand-text truncate" title={domain}>{domain}</span>
                      </div>
                    </td>
                    {modelsPresent.map(m => {
                      const val = modelCitations[m]?.[domain] || 0
                      const alpha = val > 0 ? 0.10 + (val / columnMax[m]) * 0.60 : 0
                      const c = llmColor(m)
                      const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16)
                      return (
                        <td key={m} className="p-1">
                          <div
                            className="h-8 rounded-md flex items-center justify-center text-xs font-semibold tabular-nums"
                            style={{
                              backgroundColor: val > 0 ? `rgba(${r},${g},${b},${alpha})` : 'rgba(255,255,255,0.02)',
                              color: val > 0 ? '#FDF8FC' : '#4A5268',
                            }}
                          >
                            {val || '—'}
                          </div>
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
    </div>
  )
}
