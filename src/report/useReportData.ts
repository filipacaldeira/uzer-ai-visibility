import { useEffect, useMemo, useState } from 'react'
import { api, type PromptDetail, type VisibilityData, type CompetitorsData, type PromptItem, type SourcesData } from '../api/client'
import { fetchAllPromptDetails } from '../hooks/useBrandVisibilityStats'
import { getPromptIntent, taxonomyTopicAssignments, TAXONOMY_TOPICS } from '../data/taxonomy'
import { llmLabel } from '../utils/format'

const BRAND_ID = 'c727ae2e-28f3-40f9-8e79-bc83ee402cbb'
const MY_HOSTS = ['myforce']

export interface SentRow { name: string; isMe: boolean; positive: number; total: number }
export interface AttrRow { label: string; total: number; positive: number; neutral: number }

export interface ReportData {
  brand: string
  periodLabel: string
  promptCount: number
  totalRuns: number
  models: string[]
  // score
  score: number
  trend: string
  rank: number
  marketShare: number
  avgPosition: number | null
  // sov
  sovRows: Array<{ name: string; score: number; isMe: boolean }>
  avgCompScore: number
  leaderGap: number // my score − best competitor score
  leaderName: string
  // llm
  llmCards: Array<{ model: string; label: string; avgScore: number; mentions: number; runs: number }>
  heatmap: Array<{ intent: string; cells: Record<string, number | null> }>
  // topics
  topicRows: Array<{ topic: string; avgScore: number; nPrompts: number; present: number; topComp: string | null; myRank: number | null; myVis: number; top3: Array<{ name: string; vis: number; isMe: boolean }> }>
  // intents
  intentRows: Array<{ intent: string; avgScore: number; nPrompts: number; present: number; isRef: boolean }>
  intentGap: { intent: string; compName: string; gap: number } | null
  // prompts
  bestPrompts: Array<{ text: string; score: number; position: number | null; topic: string | null }>
  gapPrompts: Array<{ text: string; citations: number; winner: string | null; topic: string | null }>
  llmTopSources: Array<{ model: string; domains: string[] }>
  zeroCount: number
  // narrative
  sentimentRows: SentRow[]
  myPositive: number
  topAttrs: AttrRow[]
  improveAttrs: AttrRow[]
  // sources
  compSources: Array<{ name: string; score: number; isMe: boolean; topSources: string[] }>
  donut: { owned: number; earned: number; competitor: number }
  concentration: number
}

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

function rangeDays(tr: string) { return tr === '7d' ? 7 : tr === '90d' ? 90 : 30 }

export function useReportData(timeRange: string): { data: ReportData | null; loading: boolean; error: string | null } {
  const [raw, setRaw] = useState<{
    vis: VisibilityData; comp: CompetitorsData; prompts: PromptItem[]; sources: SourcesData; details: PromptDetail[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setRaw(null); setError(null)
    Promise.all([
      api.visibility(BRAND_ID, timeRange),
      api.competitors(BRAND_ID, timeRange),
      api.prompts(BRAND_ID, timeRange),
      api.sources(BRAND_ID, timeRange),
      fetchAllPromptDetails(BRAND_ID, timeRange),
    ]).then(([vis, comp, prompts, sources, details]) => {
      if (alive) setRaw({ vis, comp, prompts, sources, details })
    }).catch(e => { if (alive) setError(e?.message || 'Erro ao carregar dados') })
    return () => { alive = false }
  }, [timeRange])

  const data = useMemo<ReportData | null>(() => {
    if (!raw) return null
    const { vis, comp, prompts, sources, details } = raw

    const compName: Record<string, string> = {}
    const compHosts: Record<string, string> = {}
    comp.competitors.forEach(c => {
      compName[c.id] = c.name
      try { compHosts[c.id] = new URL(c.url).hostname.replace(/^www\./, '') } catch { /* bad url */ }
    })

    const byId = new Map(details.map(d => [d.promptId, d]))
    const totalRuns = details.reduce((s, d) => s + (d.history?.length || 0), 0)
    const models = [...new Set(details.flatMap(d => (d.history || []).map(r => r.aiModel)))]

    // avg position when mentioned
    const allRanks: number[] = []
    details.forEach(d => (d.history || []).forEach(r => {
      if (r.mentioned && typeof r.rank === 'number' && r.rank > 0) allRanks.push(r.rank)
    }))
    const avgPosition = allRanks.length ? Math.round((allRanks.reduce((s, r) => s + r, 0) / allRanks.length) * 10) / 10 : null

    // SOV
    const myName = 'MyForce'
    const sovRows = [
      { name: myName, score: comp.brand.score, isMe: true },
      ...comp.competitors.map(c => ({ name: c.name, score: c.score, isMe: false })),
    ].sort((a, b) => b.score - a.score)
    const avgCompScore = comp.competitors.length
      ? Math.round((comp.competitors.reduce((s, c) => s + c.score, 0) / comp.competitors.length) * 10) / 10 : 0
    const bestComp = [...comp.competitors].sort((a, b) => b.score - a.score)[0]
    const leaderGap = comp.brand.score - (bestComp?.score || 0)
    const leaderName = bestComp?.name || '—'

    // LLM cards + per-run helper
    const perModel: Record<string, { scoreSum: number; runs: number; mentions: number }> = {}
    details.forEach(d => (d.history || []).forEach(r => {
      const m = perModel[r.aiModel] ?? (perModel[r.aiModel] = { scoreSum: 0, runs: 0, mentions: 0 })
      m.runs++; m.scoreSum += r.score || 0; if (r.mentioned) m.mentions++
    }))
    const llmCards = Object.entries(perModel)
      .map(([model, m]) => ({ model, label: llmLabel(model), avgScore: Math.round(m.scoreSum / Math.max(m.runs, 1)), mentions: m.mentions, runs: m.runs }))
      .sort((a, b) => b.avgScore - a.avgScore)

    // Heatmap intent × model (avg run score)
    const intents = ['Commercial', 'Transactional', 'Informational', 'General']
    const heatmap = intents.map(intent => {
      const ids = prompts.filter(p => getPromptIntent(p) === intent).map(p => p.promptId)
      const cells: Record<string, number | null> = {}
      models.forEach(model => {
        let sum = 0, n = 0
        ids.forEach(id => (byId.get(id)?.history || []).forEach(r => { if (r.aiModel === model) { sum += r.score || 0; n++ } }))
        cells[model] = n > 0 ? Math.round(sum / n) : null
      })
      return { intent, cells }
    }).filter(row => Object.values(row.cells).some(v => v !== null))

    // Topic rows (+ top competitor per topic)
    const topicRows = TAXONOMY_TOPICS.map(topic => {
      const ps = prompts.filter(p => taxonomyTopicAssignments[p.promptId] === topic)
      const avgScore = ps.length ? Math.round(ps.reduce((s, p) => s + p.averageScore, 0) / ps.length) : 0
      const present = ps.filter(p => p.averageScore > 0).length
      const counts: Record<string, number> = {}
      ps.forEach(p => (byId.get(p.promptId)?.history || []).forEach(run => {
        const seen = new Set<string>()
        ;(run.brandMentions || []).forEach(mn => {
          if (mn.type !== 'competitor' || !mn.competitorId || seen.has(mn.competitorId)) return
          seen.add(mn.competitorId)
          counts[mn.competitorId] = (counts[mn.competitorId] || 0) + 1
        })
      }))
      const topCompId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]
      // Full ranking (brand + competitors) by mention rate in this topic's runs
      let topicRuns = 0
      const rankCounts: Record<string, number> = {}
      ps.forEach(p => (byId.get(p.promptId)?.history || []).forEach(run => {
        topicRuns++
        const seen = new Set<string>()
        ;(run.brandMentions || []).forEach(mn => {
          if (mn.type !== 'brand' && mn.type !== 'competitor') return
          const key = mn.type === 'brand' ? '__brand__' : (mn.competitorId || mn.entityName)
          if (seen.has(key)) return
          seen.add(key)
          rankCounts[key] = (rankCounts[key] || 0) + 1
        })
      }))
      const ranked = Object.entries(rankCounts)
        .map(([key, c]) => ({
          isMe: key === '__brand__',
          name: key === '__brand__' ? 'MyForce' : (compName[key] || ''),
          vis: topicRuns > 0 ? Math.round((c / topicRuns) * 100) : 0,
        }))
        .filter(r => r.isMe || r.name)
        .sort((a, b) => b.vis - a.vis)
      const myIdx = ranked.findIndex(r => r.isMe)
      return {
        topic, avgScore, nPrompts: ps.length, present,
        topComp: topCompId ? compName[topCompId] || null : null,
        myRank: myIdx >= 0 ? myIdx + 1 : null,
        myVis: myIdx >= 0 ? ranked[myIdx].vis : 0,
        top3: ranked.slice(0, 3),
      }
    }).filter(t => t.nPrompts > 0).sort((a, b) => b.avgScore - a.avgScore)

    // Intent rows + biggest gap vs competitors (mention-rate based)
    const intentRows = intents.map(intent => {
      const ps = prompts.filter(p => getPromptIntent(p) === intent)
      const avgScore = ps.length ? Math.round(ps.reduce((s, p) => s + p.averageScore, 0) / ps.length) : 0
      return { intent, avgScore, nPrompts: ps.length, present: ps.filter(p => p.averageScore > 0).length, isRef: intent === 'General' }
    }).filter(r => r.nPrompts > 0)

    let intentGap: ReportData['intentGap'] = null
    intents.filter(i => i !== 'General').forEach(intent => {
      const ids = prompts.filter(p => getPromptIntent(p) === intent).map(p => p.promptId)
      let runs = 0, mine = 0
      const cc: Record<string, number> = {}
      ids.forEach(id => (byId.get(id)?.history || []).forEach(run => {
        runs++
        if (run.mentioned) mine++
        const seen = new Set<string>()
        ;(run.brandMentions || []).forEach(mn => {
          if (mn.type !== 'competitor' || !mn.competitorId || seen.has(mn.competitorId)) return
          seen.add(mn.competitorId); cc[mn.competitorId] = (cc[mn.competitorId] || 0) + 1
        })
      }))
      if (!runs) return
      const top = Object.entries(cc).sort((a, b) => b[1] - a[1])[0]
      if (!top) return
      const gap = Math.round(((top[1] - mine) / runs) * 100)
      if (!intentGap || gap > intentGap.gap) intentGap = { intent, compName: compName[top[0]] || '', gap }
    })

    // Best & gap prompts
    const posOf = (id: string) => {
      const ranks = (byId.get(id)?.history || []).filter(r => r.mentioned && typeof r.rank === 'number' && r.rank! > 0).map(r => r.rank as number)
      return ranks.length ? Math.round((ranks.reduce((s, r) => s + r, 0) / ranks.length) * 10) / 10 : null
    }
    const bestPrompts = [...prompts].sort((a, b) => b.averageScore - a.averageScore).slice(0, 5)
      .map(p => ({ text: p.promptText, score: Math.round(p.averageScore), position: posOf(p.promptId), topic: taxonomyTopicAssignments[p.promptId] || null }))
    const zeros = prompts.filter(p => p.averageScore === 0)
    const zeroCount = zeros.length
    const gapPrompts = zeros.map(p => {
      const d = byId.get(p.promptId)
      const domains = new Set<string>()
      const counts: Record<string, number> = {}
      ;(d?.history || []).forEach(run => {
        run.sources.forEach(s => domains.add(s.domain))
        const seen = new Set<string>()
        ;(run.brandMentions || []).forEach(mn => {
          if (mn.type !== 'competitor' || !mn.competitorId || seen.has(mn.competitorId)) return
          seen.add(mn.competitorId); counts[mn.competitorId] = (counts[mn.competitorId] || 0) + 1
        })
      })
      const winId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]
      return { text: p.promptText, citations: domains.size, winner: winId ? compName[winId] || null : null, topic: taxonomyTopicAssignments[p.promptId] || null }
    }).sort((a, b) => b.citations - a.citations).slice(0, 5)

    // Sentiment + attributes
    const sentAgg: Record<string, { pos: number; total: number }> = {}
    const attrCounts: Record<string, { pos: number; neu: number; neg: number }> = {}
    details.forEach(d => (d.history || []).forEach(run => {
      ;(run.brandMentions || []).forEach(mn => {
        if (mn.type !== 'brand' && mn.type !== 'competitor') return
        if (!mn.sentiment) return
        const s = mn.sentiment.toLowerCase()
        const name = mn.type === 'brand' ? myName : compName[mn.competitorId || '']
        if (!name) return
        const a = sentAgg[name] ?? (sentAgg[name] = { pos: 0, total: 0 })
        a.total++; if (s === 'positive') a.pos++
        if (mn.type === 'brand' && mn.mentionSummary) {
          const t = mn.mentionSummary.toLowerCase()
          ATTRS.forEach(at => {
            if (!at.re.test(t)) return
            const c = attrCounts[at.label] ?? (attrCounts[at.label] = { pos: 0, neu: 0, neg: 0 })
            if (s === 'positive') c.pos++; else if (s === 'negative') c.neg++; else c.neu++
          })
        }
      })
    }))
    const sentimentRows: SentRow[] = Object.entries(sentAgg)
      .map(([name, a]) => ({ name, isMe: name === myName, positive: Math.round((a.pos / Math.max(a.total, 1)) * 100), total: a.total }))
      .filter(r => r.total >= 10)
      .sort((a, b) => b.positive - a.positive)
    const myPositive = sentimentRows.find(r => r.isMe)?.positive ?? 0
    const attrRows: AttrRow[] = Object.entries(attrCounts)
      .map(([label, c]) => {
        const total = c.pos + c.neu + c.neg
        return { label, total, positive: Math.round((c.pos / Math.max(total, 1)) * 100), neutral: Math.round((c.neu / Math.max(total, 1)) * 100) }
      })
      .filter(r => r.total >= 10)
    const topAttrs = [...attrRows].sort((a, b) => b.positive - a.positive || b.total - a.total).slice(0, 3)
    const improveAttrs = [...attrRows].sort((a, b) => a.positive - b.positive || b.neutral - a.neutral).slice(0, 3)

    // Competitor top sources (domains most cited in runs where the competitor appears)
    const compSources = sovRows.map(row => {
      const isMe = row.isMe
      const id = isMe ? null : comp.competitors.find(c => c.name === row.name)?.id
      const dCounts: Record<string, number> = {}
      details.forEach(d => (d.history || []).forEach(run => {
        const hit = isMe ? run.mentioned : (run.brandMentions || []).some(mn => mn.type === 'competitor' && mn.competitorId === id)
        if (!hit) return
        run.sources.forEach(s => { dCounts[s.domain] = (dCounts[s.domain] || 0) + 1 })
      }))
      const topSources = Object.entries(dCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([dom]) => dom)
      return { name: row.name, score: row.score, isMe, topSources }
    })

    // Top 3 cited domains per LLM
    const modelDomains: Record<string, Record<string, number>> = {}
    details.forEach(d => (d.history || []).forEach(run => {
      const md = modelDomains[run.aiModel] ?? (modelDomains[run.aiModel] = {})
      run.sources.forEach(src => { md[src.domain] = (md[src.domain] || 0) + 1 })
    }))
    const llmTopSources = models.map(model => ({
      model,
      domains: Object.entries(modelDomains[model] || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([dom]) => dom),
    })).filter(r => r.domains.length > 0)

    // Owned / earned / competitor donut + concentration (from /sources)
    const hostList = Object.values(compHosts)
    let owned = 0, earned = 0, competitor = 0, totalCit = 0
    const citList: number[] = []
    sources.sources.forEach(s => {
      const c = s.mentions || 0
      totalCit += c; citList.push(c)
      const dom = (s.domain || '').toLowerCase()
      if (MY_HOSTS.some(h => dom.includes(h))) owned += c
      else if (hostList.some(h => h && dom.includes(h.replace(/\.(pt|com|es|fr)$/, '')))) competitor += c
      else earned += c
    })
    const pctc = (n: number) => totalCit > 0 ? Math.round((n / totalCit) * 100) : 0
    const top5 = citList.sort((a, b) => b - a).slice(0, 5).reduce((s, c) => s + c, 0)
    const concentration = pctc(top5)

    const days = rangeDays(timeRange)
    const end = new Date()
    const start = new Date(Date.now() - days * 86400000)
    const fmt = (d: Date) => d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })
    const periodLabel = `${fmt(start)} – ${fmt(end)} ${end.getFullYear()}`

    return {
      brand: myName,
      periodLabel,
      promptCount: prompts.length,
      totalRuns,
      models,
      score: vis.visibility.score,
      trend: vis.visibility.trend,
      rank: comp.summary.brandRankAmongCompetitors || sovRows.findIndex(r => r.isMe) + 1,
      marketShare: vis.marketShare.percentage,
      avgPosition,
      sovRows, avgCompScore, leaderGap, leaderName,
      llmCards, heatmap,
      topicRows, intentRows, intentGap,
      bestPrompts, gapPrompts, zeroCount,
      llmTopSources,
      sentimentRows, myPositive, topAttrs, improveAttrs,
      compSources,
      donut: { owned: pctc(owned), earned: pctc(earned), competitor: pctc(competitor) },
      concentration,
    }
  }, [raw])

  return { data, loading: !raw && !error, error }
}
