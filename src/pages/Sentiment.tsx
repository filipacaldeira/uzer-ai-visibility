import { useState, useEffect, useMemo } from 'react'
import {
  ResponsiveContainer, XAxis, YAxis, Tooltip, LineChart, Line, CartesianGrid, } from 'recharts'
import { api, type PromptDetail } from '../api/client'
import { fetchAllPromptDetails } from '../hooks/useBrandVisibilityStats'
import { brandColor, brandStroke, llmLabel, llmDomain, MY_BRAND_COLOR } from '../utils/format'
import { InfoTip } from '../components/ui/InfoTip'
import { useApi } from '../hooks/useApi'
import { Header } from '../components/layout/Header'
import { KPICard } from '../components/ui/KPICard'
import { ErrorState, PageSkeleton } from '../components/ui/LoadingState'
import { Favicon } from '../components/ui/Favicon'

const BRAND_ID = 'c727ae2e-28f3-40f9-8e79-bc83ee402cbb'

const SENT_COLORS = { positive: '#22C55E', neutral: '#8B93A9', negative: '#E05252' }

type SentCounts = { pos: number; neu: number; neg: number }

function pct(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0
}

function AttrRow({ rank, attr, accent }: {
  rank: number
  attr: { label: string; total: number; positive: number; neutral: number; negative: number }
  accent: string
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span
          className="w-4.5 h-4.5 min-w-[18px] rounded-full text-2xs font-bold flex items-center justify-center"
          style={{ backgroundColor: `${accent}22`, color: accent }}
        >
          {rank}
        </span>
        <span className="text-xs font-medium text-brand-text flex-1">{attr.label}</span>
        <span className="text-xs font-semibold" style={{ color: accent }}>{attr.positive}%</span>
      </div>
      <div className="flex items-center gap-2 pl-6">
        <div className="flex-1 h-2.5 rounded-full overflow-hidden flex bg-brand-border">
          <div style={{ width: `${attr.positive}%`, backgroundColor: SENT_COLORS.positive }} />
          <div style={{ width: `${attr.neutral}%`, backgroundColor: SENT_COLORS.neutral, opacity: 0.45 }} />
          <div style={{ width: `${attr.negative}%`, backgroundColor: SENT_COLORS.negative }} />
        </div>
        <span className="text-2xs text-brand-dim w-20 text-right">{attr.total} menções</span>
      </div>
    </div>
  )
}

export default function Sentiment() {
  const [timeRange, setTimeRange] = useState('30d')
  const [details, setDetails] = useState<PromptDetail[] | null>(null)

  const { data: comp, loading, error, refetch } = useApi(
    () => api.competitors(BRAND_ID, timeRange), [timeRange]
  )

  useEffect(() => {
    let alive = true
    setDetails(null)
    fetchAllPromptDetails(BRAND_ID, timeRange).then(d => { if (alive) setDetails(d) })
    return () => { alive = false }
  }, [timeRange])

  // One aggregation pass over the run history: sentiment of each canonical
  // brand's mentions — overall per brand, per AI model (MyForce only) and per
  // day (MyForce only). Same canonical dedup rules as the rest of the dashboard.
  const agg = useMemo(() => {
    if (!details || !comp) return null
    const compName: Record<string, string> = {}
    comp.competitors.forEach(c => { compName[c.id] = c.name })

    const byBrand: Record<string, SentCounts> = {}
    const myByModel: Record<string, SentCounts> = {}
    const myByDay: Record<string, SentCounts> = {}
    const bump = (target: Record<string, SentCounts>, key: string, s: string) => {
      const t = target[key] ?? (target[key] = { pos: 0, neu: 0, neg: 0 })
      if (s === 'positive') t.pos++
      else if (s === 'negative') t.neg++
      else t.neu++
    }

    details.forEach(d => {
      ;(d.history || []).forEach(run => {
        const model = run.aiModel || 'unknown'
        const day = (run.date || '').slice(0, 10)
        ;(run.brandMentions || []).forEach(m => {
          if (m.type !== 'brand' && m.type !== 'competitor') return
          if (!m.sentiment) return
          const s = m.sentiment.toLowerCase()
          const isMe = m.type === 'brand'
          const name = isMe ? 'MyForce' : compName[m.competitorId || '']
          if (!name) return // stray unmapped entity
          bump(byBrand, name, s)
          if (isMe) {
            bump(myByModel, model, s)
            if (day) bump(myByDay, day, s)
          }
        })
      })
    })
    return { byBrand, myByModel, myByDay }
  }, [details, comp])

  const my = agg?.byBrand['MyForce']

  // Attribute mining over MyForce mention summaries. The API's mentionSummary
  // text is English (Peekaboo summarises the PT answers in English), so the
  // patterns are English; the labels shown are Portuguese. A mention can match
  // more than one attribute; attributes with fewer than 10 mentions are hidden.
  const attrRows = useMemo(() => {
    if (!details) return []
    const ATTRS: Array<{ label: string; re: RegExp }> = [
      { label: 'Qualidade & profissionalismo', re: /quality|professional|expert|certified|specialized|qualified|competent/ },
      { label: 'Elétricos / híbridos', re: /electric|hybrid|\bev\b/ },
      { label: 'Conveniência (transporte, marcação, horários)', re: /transport|pick-?up|drive the car|schedul|booking|extended hours|convenien|hassle/ },
      { label: 'Pneus', re: /tire|tyre|pneu/ },
      { label: 'Revisão & manutenção', re: /maintenance|revision|servicing|oil change|preventive/ },
      { label: 'Garantia do fabricante', re: /warrant|homologated|manufacturer/ },
      { label: 'Inspeção / pré-inspeção (IPO)', re: /inspection|pre-inspection|\bipo\b/ },
      { label: 'Diagnóstico & reparação técnica', re: /diagnos|repair|mechanical|regeneration|filter/ },
      { label: 'Preço / competitividade', re: /price|pricing|cost|affordab|competitive|cheap|value/ },
      { label: 'Rede / cobertura nacional', re: /network|nationwide|locations|multi-brand|branches|across portugal/ },
      { label: 'Confiança & reputação', re: /trust|reputat|reliab|solid|confiden|renowned|well-known|known for|credib/ },
      { label: 'Serviços gratuitos / check-up', re: /free (check|diagnos|inspection|visual)|no cost|complimentary|freemium/ },
    ]
    const counts: Record<string, SentCounts> = {}
    details.forEach(d => {
      ;(d.history || []).forEach(run => {
        ;(run.brandMentions || []).forEach(m => {
          if (m.type !== 'brand' || !m.mentionSummary || !m.sentiment) return
          const t = m.mentionSummary.toLowerCase()
          const sent = m.sentiment.toLowerCase()
          ATTRS.forEach(a => {
            if (!a.re.test(t)) return
            const c = counts[a.label] ?? (counts[a.label] = { pos: 0, neu: 0, neg: 0 })
            if (sent === 'positive') c.pos++
            else if (sent === 'negative') c.neg++
            else c.neu++
          })
        })
      })
    })
    return Object.entries(counts)
      .map(([label, c]) => {
        const total = c.pos + c.neu + c.neg
        return { label, total, positive: pct(c.pos, total), neutral: pct(c.neu, total), negative: pct(c.neg, total) }
      })
      .filter(r => r.total >= 10)
      .sort((a, b) => b.positive - a.positive || b.total - a.total)
  }, [details])

  const topAttrs = attrRows.slice(0, 3)
  const improveAttrs = [...attrRows].sort((a, b) => a.positive - b.positive || b.neutral - a.neutral).slice(0, 3)

  const myTotal = my ? my.pos + my.neu + my.neg : 0

  // Brands ranked by % positive (stacked pos/neu/neg per brand)
  const brandRows = useMemo(() => {
    if (!agg) return []
    return Object.entries(agg.byBrand)
      .map(([name, c]) => {
        const total = c.pos + c.neu + c.neg
        return {
          name,
          isMe: name === 'MyForce',
          total,
          positive: pct(c.pos, total),
          neutral: pct(c.neu, total),
          negative: pct(c.neg, total),
        }
      })
      .filter(r => r.total >= 10) // too few mentions → % not meaningful
      .sort((a, b) => b.positive - a.positive)
  }, [agg])

  // MyForce sentiment per LLM
  const modelRows = useMemo(() => {
    if (!agg) return []
    return Object.entries(agg.myByModel)
      .map(([model, c]) => {
        const total = c.pos + c.neu + c.neg
        return {
          model,
          label: llmLabel(model),
          total,
          positive: pct(c.pos, total),
          neutral: pct(c.neu, total),
          negative: pct(c.neg, total),
        }
      })
      .sort((a, b) => b.positive - a.positive)
  }, [agg])

  // Daily % positive for MyForce
  const timeline = useMemo(() => {
    if (!agg) return []
    return Object.entries(agg.myByDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, c]) => {
        const total = c.pos + c.neu + c.neg
        return {
          date: new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
          positive: pct(c.pos, total),
          negative: pct(c.neg, total),
          mentions: total,
        }
      })
  }, [agg])

  const bestModel = modelRows[0]
  const worstModel = modelRows[modelRows.length - 1]
  const myRankBySent = brandRows.findIndex(r => r.isMe) + 1

  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (loading || !agg) return <><Header title="Sentiment" timeRange={timeRange} onTimeRangeChange={setTimeRange} /><PageSkeleton /></>

  const stackTooltip = (
    <Tooltip
      contentStyle={{ backgroundColor: '#1A2033', border: '1px solid #2D3654', borderRadius: 8 }}
      formatter={(v, name) => [`${v}%`, String(name).charAt(0).toUpperCase() + String(name).slice(1)]}
    />
  )

  return (
    <div className="space-y-6">
      <Header
        title="Sentiment"
        subtitle="How AI models talk about the brand"
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Positive Sentiment"
          value={`${pct(my?.pos || 0, myTotal)}%`}
          accent
          deltaDir="up"
          subtitle={`of ${myTotal.toLocaleString()} MyForce mentions`}
          tooltip="% of MyForce mentions across all AI answers classified as positive in the period."
        />
        <KPICard
          label="Negative Sentiment"
          value={`${pct(my?.neg || 0, myTotal)}%`}
          deltaDir={pct(my?.neg || 0, myTotal) > 10 ? 'down' : 'up'}
          subtitle={`${(my?.neg || 0).toLocaleString()} mentions`}
          tooltip="% of MyForce mentions classified as negative. Below 10% is healthy."
        />
        <KPICard
          label="Sentiment Rank"
          value={myRankBySent > 0 ? `#${myRankBySent}` : '—'}
          subtitle={`of ${brandRows.length} brands by % positive`}
          tooltip="MyForce's position among tracked brands when ranked by share of positive mentions."
        />
        <KPICard
          label="Most Positive LLM"
          value={bestModel ? bestModel.label : '—'}
          subtitle={bestModel ? `${bestModel.positive}% positive` : ''}
          tooltip="The AI model whose answers mention MyForce with the highest share of positive sentiment."
        />
      </div>

      {/* Sentiment by brand + by LLM */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card">
          <p className="section-title inline-flex items-center gap-1.5">
            Sentiment by Brand
            <InfoTip text="Share of positive / neutral / negative sentiment across each brand's mentions in AI answers. Ranked by % positive; brands with fewer than 10 classified mentions are omitted." />
          </p>
          <div className="space-y-2.5 mt-1">
            {brandRows.map(r => {
              const color = brandColor(r.name, r.isMe)
              return (
                <div key={r.name} className="flex items-center gap-3">
                  <div className="w-28 flex items-center gap-1.5 flex-shrink-0">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color, boxShadow: brandStroke(color) ? `0 0 0 1px ${brandStroke(color)}` : undefined }}
                    />
                    <span className={`text-xs truncate ${r.isMe ? 'font-semibold text-brand-primary' : 'text-brand-text'}`}>{r.name}</span>
                  </div>
                  <div className="flex-1 h-4 rounded-full overflow-hidden flex bg-brand-border">
                    <div style={{ width: `${r.positive}%`, backgroundColor: SENT_COLORS.positive }} title={`Positive ${r.positive}%`} />
                    <div style={{ width: `${r.neutral}%`, backgroundColor: SENT_COLORS.neutral, opacity: 0.45 }} title={`Neutral ${r.neutral}%`} />
                    <div style={{ width: `${r.negative}%`, backgroundColor: SENT_COLORS.negative }} title={`Negative ${r.negative}%`} />
                  </div>
                  <span className="w-10 text-right text-xs font-semibold" style={{ color: SENT_COLORS.positive }}>{r.positive}%</span>
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-4 mt-4 justify-center text-2xs text-brand-muted">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: SENT_COLORS.positive }} />Positive</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: SENT_COLORS.neutral, opacity: 0.45 }} />Neutral</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: SENT_COLORS.negative }} />Negative</span>
          </div>
        </div>

        <div className="card">
          <p className="section-title inline-flex items-center gap-1.5">
            MyForce Sentiment by LLM
            <InfoTip text="How each AI model's answers classify MyForce mentions: % positive / neutral / negative per model." />
          </p>
          <div className="space-y-2.5 mt-1">
            {modelRows.map(m => {
              const domain = llmDomain(m.model)
              return (
                <div key={m.model} className="flex items-center gap-3">
                  <div className="w-32 flex items-center gap-1.5 flex-shrink-0">
                    {domain && <Favicon domain={domain} size={13} />}
                    <span className="text-xs text-brand-text truncate">{m.label}</span>
                  </div>
                  <div className="flex-1 h-4 rounded-full overflow-hidden flex bg-brand-border">
                    <div style={{ width: `${m.positive}%`, backgroundColor: SENT_COLORS.positive }} title={`Positive ${m.positive}%`} />
                    <div style={{ width: `${m.neutral}%`, backgroundColor: SENT_COLORS.neutral, opacity: 0.45 }} title={`Neutral ${m.neutral}%`} />
                    <div style={{ width: `${m.negative}%`, backgroundColor: SENT_COLORS.negative }} title={`Negative ${m.negative}%`} />
                  </div>
                  <span className="w-10 text-right text-xs font-semibold" style={{ color: SENT_COLORS.positive }}>{m.positive}%</span>
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-4 mt-4 justify-center text-2xs text-brand-muted">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: SENT_COLORS.positive }} />Positive</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: SENT_COLORS.neutral, opacity: 0.45 }} />Neutral</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: SENT_COLORS.negative }} />Negative</span>
          </div>
        </div>
      </div>

      {/* Sentiment by attribute */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card">
          <p className="section-title inline-flex items-center gap-1.5">
            Top 3 — Atributos Mais Positivos
            <InfoTip text="Attributes where MyForce mentions carry the highest share of positive sentiment, mined from Peekaboo's per-mention summaries (a mention can count in more than one attribute; attributes with fewer than 10 mentions are omitted)." />
          </p>
          <div className="space-y-3 mt-2">
            {topAttrs.map((a, i) => (
              <AttrRow key={a.label} rank={i + 1} attr={a} accent="#22C55E" />
            ))}
          </div>
        </div>
        <div className="card">
          <p className="section-title inline-flex items-center gap-1.5">
            Top 3 — Atributos a Melhorar
            <InfoTip text="Attributes with the lowest share of positive sentiment — mostly neutral, undifferentiated mentions (listed among competitors without being recommended). No negative mentions were recorded in the period." />
          </p>
          <div className="space-y-3 mt-2">
            {improveAttrs.map((a, i) => (
              <AttrRow key={a.label} rank={i + 1} attr={a} accent="#F5A623" />
            ))}
          </div>
          <p className="text-2xs text-brand-dim mt-3">
            Menções neutras = a marca aparece listada sem ser recomendada ou destacada.
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div className="card">
        <p className="section-title inline-flex items-center gap-1.5">
          MyForce Sentiment Over Time
          <InfoTip text="Daily share of positive and negative sentiment across MyForce mentions in AI answers. Gaps in mentions on a day can make the line volatile." />
        </p>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={timeline} margin={{ top: 8, right: 16, left: -18 }}>
            <CartesianGrid stroke="#1E2535" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={28} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1A2033', border: '1px solid #2D3654', borderRadius: 8 }}
              formatter={(v, name) => [`${v}%`, name === 'positive' ? 'Positive' : 'Negative']}
              labelFormatter={(l, payload) => `${l} · ${payload?.[0]?.payload?.mentions ?? 0} mentions`}
            />
            <Line type="monotone" dataKey="positive" stroke={SENT_COLORS.positive} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="negative" stroke={SENT_COLORS.negative} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-1 justify-center text-2xs text-brand-muted">
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 inline-block" style={{ backgroundColor: SENT_COLORS.positive }} />% Positive</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 inline-block" style={{ backgroundColor: SENT_COLORS.negative }} />% Negative</span>
        </div>
      </div>

      {/* Insight banner */}
      {bestModel && worstModel && bestModel.model !== worstModel.model && (
        <div className="card border-brand-secondary/20 bg-brand-secondary/5">
          <p className="text-xs text-brand-muted mb-1 uppercase tracking-wider font-medium">Sentiment Insight</p>
          <p className="text-sm text-brand-text">
            <strong>{bestModel.label}</strong> talks about MyForce most positively ({bestModel.positive}% positive),
            while <strong>{worstModel.label}</strong> is the least favourable ({worstModel.positive}% positive,
            {' '}{worstModel.negative}% negative). Content cited by {worstModel.label} is where sentiment work pays off first.
          </p>
        </div>
      )}
    </div>
  )
}
