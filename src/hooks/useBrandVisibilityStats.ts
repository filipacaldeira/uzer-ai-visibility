import { useEffect, useState } from 'react'
import { api, type PromptDetail } from '../api/client'

// Module-level cache so Overview and ByPrompt can share the same batch of
// per-prompt detail requests without refetching (keyed by brand + time range).
const detailCache: Record<string, Promise<PromptDetail[]>> = {}

export function fetchAllPromptDetails(brandId: string, timeRange: string): Promise<PromptDetail[]> {
  const key = `${brandId}|${timeRange}`
  if (!detailCache[key]) {
    detailCache[key] = (async () => {
      // Let the page's core endpoints (visibility/snapshot/competitors) land
      // first — the burst of detail requests can starve them on the proxy.
      await new Promise(r => setTimeout(r, 1200))
      const prompts = await api.prompts(brandId, timeRange)
      const out: PromptDetail[] = []
      const BATCH = 16
      for (let i = 0; i < prompts.length; i += BATCH) {
        const batch = prompts.slice(i, i + BATCH)
        const results = await Promise.allSettled(
          batch.map(p => api.promptDetail(brandId, p.promptId, timeRange))
        )
        results.forEach(r => { if (r.status === 'fulfilled') out.push(r.value) })
      }
      return out
    })()
  }
  return detailCache[key]
}

export interface BrandVisibilityStat {
  name: string
  isMe: boolean
  /** % of all analysed runs that mention this brand (matches Peekaboo UI "Visibility") */
  visibility: number
  /** % of this brand's mentions with positive sentiment */
  sentiment: number | null
  /** Average rank of the brand within AI answers (1 = first mentioned) */
  position: number | null
  mentions: number
}

/**
 * Aggregates every run of every tracked prompt into per-brand stats
 * (visibility %, positive-sentiment %, avg position) — the same computation
 * the native Peekaboo UI shows in its Competitors table.
 *
 * Entity names in run data are raw ("Midas", "MIDAS", "Midas Portugal",
 * "MyForce Gaia"…), so mentions are grouped by canonical identity:
 * type === 'brand' for the tracked brand, competitorId for competitors.
 * Each canonical brand counts at most once per run for visibility.
 */
export interface TimelinePoint {
  /** ISO date (YYYY-MM-DD) */
  date: string
  /** brand display name → % of that day's runs mentioning the brand */
  values: Record<string, number>
}

export interface BrandStatsResult {
  /** Aggregated across every run of every LLM */
  all: BrandVisibilityStat[]
  /** Same aggregation restricted to each aiModel's runs */
  byModel: Record<string, BrandVisibilityStat[]>
  /** Daily visibility % per brand, from the run history sample */
  timeline: TimelinePoint[]
}

type Bucket = { isMe: boolean; mentions: number; ranks: number[]; pos: number; neu: number; neg: number; nameVotes: Record<string, number> }
type Agg = Record<string, Bucket>

function buildRows(agg: Agg, totalRuns: number, compNames: Record<string, string>): BrandVisibilityStat[] {
  return Object.entries(agg).map(([key, a]) => {
    const sentTotal = a.pos + a.neu + a.neg
    const canonical = key !== '__brand__' && compNames[key]
    const votedName = Object.entries(a.nameVotes).sort((x, y) => y[1] - x[1])[0]?.[0] || key
    return {
      name: canonical || votedName,
      isMe: a.isMe,
      visibility: totalRuns > 0 ? Math.round((a.mentions / totalRuns) * 100) : 0,
      sentiment: sentTotal > 0 ? Math.round((a.pos / sentTotal) * 100) : null,
      position: a.ranks.length > 0 ? Math.round((a.ranks.reduce((s, r) => s + r, 0) / a.ranks.length) * 10) / 10 : null,
      mentions: a.mentions,
    }
  })
    // Keep the brand + known competitors; drop stray unmapped entities
    .filter(r => r.isMe || Object.values(compNames).includes(r.name))
    .sort((x, y) => y.visibility - x.visibility)
}

export function useBrandVisibilityStats(brandId: string, timeRange: string, enabled = true) {
  const [stats, setStats] = useState<BrandStatsResult | null>(null)

  useEffect(() => {
    // Wait until the page's core endpoints have settled before firing the
    // 50-request detail flood — the upstream /visibility endpoint is slow and
    // gets starved when it competes with these batches (zeros on first visit).
    if (!enabled) return
    let alive = true
    setStats(null)
    Promise.all([
      fetchAllPromptDetails(brandId, timeRange),
      api.competitors(brandId, timeRange).catch(() => null),
    ]).then(([details, comp]) => {
      if (!alive) return
      const compNames: Record<string, string> = {}
      comp?.competitors.forEach(c => { compNames[c.id] = c.name })

      let totalRuns = 0
      const runsByModel: Record<string, number> = {}
      const agg: Agg = {}
      const aggByModel: Record<string, Agg> = {}
      // Per-day: total runs + mentioned-run count per canonical brand key
      const perDate: Record<string, { runs: number; mentions: Record<string, number> }> = {}

      const mergeInto = (target: Agg, key: string, v: { isMe: boolean; bestRank: number | null; names: string[]; sents: string[] }) => {
        const a = target[key] ?? (target[key] = { isMe: v.isMe, mentions: 0, ranks: [], pos: 0, neu: 0, neg: 0, nameVotes: {} })
        a.mentions++
        if (v.bestRank !== null) a.ranks.push(v.bestRank)
        v.sents.forEach(s => {
          if (s === 'positive') a.pos++
          else if (s === 'negative') a.neg++
          else a.neu++
        })
        v.names.forEach(n => { a.nameVotes[n] = (a.nameVotes[n] || 0) + 1 })
      }

      details.forEach(d => {
        ;(d.history || []).forEach(run => {
          totalRuns++
          const model = run.aiModel || 'unknown'
          runsByModel[model] = (runsByModel[model] || 0) + 1
          if (!aggByModel[model]) aggByModel[model] = {}
          const day = (run.date || '').slice(0, 10)
          const pd = day ? (perDate[day] ?? (perDate[day] = { runs: 0, mentions: {} })) : null
          if (pd) pd.runs++
          // Dedupe canonical brands within this run: best (lowest) rank wins
          const inRun = new Map<string, { isMe: boolean; bestRank: number | null; names: string[]; sents: string[] }>()
          ;(run.brandMentions || []).forEach(m => {
            const isMe = m.type === 'brand'
            if (!isMe && m.type !== 'competitor') return
            const key = isMe ? '__brand__' : (m.competitorId || m.entityName)
            const cur = inRun.get(key) ?? { isMe, bestRank: null, names: [], sents: [] }
            if (typeof m.rank === 'number' && m.rank > 0 && (cur.bestRank === null || m.rank < cur.bestRank)) cur.bestRank = m.rank
            cur.names.push(m.entityName)
            if (m.sentiment) cur.sents.push(m.sentiment.toLowerCase())
            inRun.set(key, cur)
          })
          inRun.forEach((v, key) => {
            mergeInto(agg, key, v)
            mergeInto(aggByModel[model], key, v)
            if (pd) pd.mentions[key] = (pd.mentions[key] || 0) + 1
          })
        })
      })

      const byModel: Record<string, BrandVisibilityStat[]> = {}
      Object.entries(aggByModel).forEach(([model, a]) => {
        byModel[model] = buildRows(a, runsByModel[model] || 0, compNames)
      })

      const all = buildRows(agg, totalRuns, compNames)

      // Canonical key → display name (same resolution as buildRows), limited to kept brands
      const keptNames = new Set(all.map(r => r.name))
      const keyName: Record<string, string> = {}
      Object.entries(agg).forEach(([key, a]) => {
        const votedName = Object.entries(a.nameVotes).sort((x, y) => y[1] - x[1])[0]?.[0] || key
        const name = (key !== '__brand__' && compNames[key]) || votedName
        if (keptNames.has(name)) keyName[key] = name
      })

      const timeline: TimelinePoint[] = Object.entries(perDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, pd]) => {
          const values: Record<string, number> = {}
          Object.entries(keyName).forEach(([key, name]) => {
            values[name] = pd.runs > 0 ? Math.round(((pd.mentions[key] || 0) / pd.runs) * 100) : 0
          })
          return { date, values }
        })

      setStats({ all, byModel, timeline })
    }).catch(err => {
      console.error('brand stats aggregation failed:', err)
      if (alive) setStats({ all: [], byModel: {}, timeline: [] })
    })
    return () => { alive = false }
  }, [brandId, timeRange, enabled])

  return stats
}
