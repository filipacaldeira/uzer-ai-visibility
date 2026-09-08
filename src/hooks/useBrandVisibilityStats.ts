import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { api, isRateLimited, type PromptDetail, type CompetitorsData } from '../api/client'
import { shortBrand } from '../utils/format'

// ─── Prompt-detail store ─────────────────────────────────────────────────────
// One shared batch per brand+timeRange. The first cycle fetches every prompt's
// run history in chunks; prompts that fail (e.g. under API rate limiting) are
// retried in later passes and then in a background loop until complete, and
// subscribers are notified on every new chunk. Nothing is silently dropped:
// the store always knows how many prompts are still missing, and the UI can
// show a "partial data" notice instead of presenting an incomplete set as
// complete.

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const PASS_DELAYS = [0, 5000, 15000, 30000]
const BG_RETRY_MS = 60000
const MAX_BG_RETRIES = 10

export interface PromptDetailsSnapshot {
  details: PromptDetail[]
  total: number | null
  /** first cycle (passes included) still running */
  loading: boolean
  /** first cycle done but some prompts are still missing (background retries continue) */
  partial: boolean
}

interface DetailEntry {
  byId: Record<string, PromptDetail>
  total: number | null
  settled: boolean
  complete: boolean
  running: boolean
  version: number
  listeners: Set<() => void>
  snapshot: PromptDetailsSnapshot | null
  settlePromise: Promise<PromptDetail[]>
  resolveSettle: (d: PromptDetail[]) => void
  settleResolved: boolean
}

const store: Record<string, DetailEntry> = {}
const globalListeners = new Set<() => void>()
let globalSnapshot: { partial: boolean; loaded: number; total: number } | null = null

function entryFor(key: string): DetailEntry {
  if (!store[key]) {
    let resolveSettle!: (d: PromptDetail[]) => void
    const settlePromise = new Promise<PromptDetail[]>(r => { resolveSettle = r })
    store[key] = {
      byId: {}, total: null, settled: false, complete: false, running: false,
      version: 0, listeners: new Set(), snapshot: null,
      settlePromise, resolveSettle, settleResolved: false,
    }
  }
  return store[key]
}

function notify(e: DetailEntry) {
  e.version++
  e.snapshot = null
  globalSnapshot = null
  e.listeners.forEach(f => f())
  globalListeners.forEach(f => f())
}

function settle(e: DetailEntry) {
  e.settled = true
  if (!e.settleResolved) {
    e.settleResolved = true
    e.resolveSettle(Object.values(e.byId))
  }
}

async function runCycle(brandId: string, timeRange: string, e: DetailEntry) {
  if (e.running || e.complete) return
  e.running = true
  try {
    // Let the page's core endpoints land first — the burst of detail requests
    // can starve them on the proxy.
    await sleep(1200)
    const prompts = await api.prompts(brandId, timeRange)
    e.total = prompts.length
    notify(e)

    const fetchMissing = async (): Promise<number> => {
      const missing = prompts.filter(p => !e.byId[p.promptId])
      let i = 0
      while (i < missing.length) {
        // Smaller chunks while the API is rate-limiting us
        const size = isRateLimited() ? 4 : 16
        const chunk = missing.slice(i, i + size)
        i += size
        const results = await Promise.allSettled(chunk.map(p => api.promptDetail(brandId, p.promptId, timeRange)))
        let got = false
        results.forEach((r, j) => {
          if (r.status === 'fulfilled') { e.byId[chunk[j].promptId] = r.value; got = true }
        })
        if (got) notify(e)
      }
      return prompts.filter(p => !e.byId[p.promptId]).length
    }

    let missing = prompts.length
    for (const delay of PASS_DELAYS) {
      if (delay) await sleep(delay)
      missing = await fetchMissing()
      if (missing === 0) break
    }
    e.complete = missing === 0
    settle(e)
    notify(e)

    // Background completion: keep retrying until every prompt is in
    for (let n = 0; !e.complete && n < MAX_BG_RETRIES; n++) {
      await sleep(BG_RETRY_MS)
      try { e.complete = (await fetchMissing()) === 0 } catch { /* next round */ }
      notify(e)
    }
  } catch (err) {
    console.error('prompt detail batch failed:', err)
    settle(e)
    notify(e)
  } finally {
    e.running = false
  }
}

function startBatch(brandId: string, timeRange: string): DetailEntry {
  const e = entryFor(`${brandId}|${timeRange}`)
  if (!e.running && !e.complete) void runCycle(brandId, timeRange, e)
  return e
}

/** Compat promise API: resolves when the first retry cycle finishes (data may
 *  still be partial then — prefer usePromptDetails for live/partial state). */
export function fetchAllPromptDetails(brandId: string, timeRange: string): Promise<PromptDetail[]> {
  return startBatch(brandId, timeRange).settlePromise
}

/** Live view over the shared detail batch (progressive + background retries). */
export function usePromptDetails(brandId: string, timeRange: string, enabled = true): PromptDetailsSnapshot {
  const key = `${brandId}|${timeRange}`
  const subscribe = useCallback((cb: () => void) => {
    if (!enabled) return () => {}
    const e = startBatch(brandId, timeRange)
    e.listeners.add(cb)
    return () => { e.listeners.delete(cb) }
  }, [brandId, timeRange, enabled])
  const getSnapshot = useCallback((): PromptDetailsSnapshot => {
    const e = entryFor(key)
    if (!e.snapshot) {
      e.snapshot = {
        details: Object.values(e.byId),
        total: e.total,
        loading: !e.settled,
        partial: e.settled && !e.complete,
      }
    }
    return e.snapshot
  }, [key])
  return useSyncExternalStore(subscribe, getSnapshot)
}

const EMPTY_HEALTH = { partial: false, loaded: 0, total: 0 }

/** Global "is anything partial?" flag for the partial-data notice. */
export function useDetailHealth(): { partial: boolean; loaded: number; total: number } {
  const subscribe = useCallback((cb: () => void) => {
    globalListeners.add(cb)
    return () => { globalListeners.delete(cb) }
  }, [])
  const getSnapshot = useCallback(() => {
    if (!globalSnapshot) {
      let loaded = 0, total = 0, partial = false
      Object.values(store).forEach(e => {
        if (e.settled && !e.complete && e.total != null) {
          partial = true
          loaded += Object.keys(e.byId).length
          total += e.total
        }
      })
      globalSnapshot = partial ? { partial, loaded, total } : EMPTY_HEALTH
    }
    return globalSnapshot
  }, [])
  return useSyncExternalStore(subscribe, getSnapshot)
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
      name: canonical || shortBrand(votedName),
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
  const { details, loading } = usePromptDetails(brandId, timeRange, enabled)
  const [comp, setComp] = useState<CompetitorsData | null>(null)

  useEffect(() => {
    if (!enabled) return
    let alive = true
    api.competitors(brandId, timeRange)
      .then(c => { if (alive) setComp(c) })
      .catch(() => { if (alive) setComp(null) })
    return () => { alive = false }
  }, [brandId, timeRange, enabled])

  return useMemo<BrandStatsResult | null>(() => {
    if (!enabled || loading) return null
      const compNames: Record<string, string> = {}
      comp?.competitors.forEach(c => { compNames[c.id] = c.name })

      let totalRuns = 0
      const runsByModel: Record<string, number> = {}
      const agg: Agg = {}
      const aggByModel: Record<string, Agg> = {}
      // Per-day: total runs + mentioned-run count + score sum per canonical brand key
      const perDate: Record<string, { runs: number; mentions: Record<string, number>; scoreSum: Record<string, number> }> = {}

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
          const pd = day ? (perDate[day] ?? (perDate[day] = { runs: 0, mentions: {}, scoreSum: {} })) : null
          if (pd) {
            pd.runs++
            // Brand: the run-level score (0-100; 0 when the brand is absent)
            pd.scoreSum['__brand__'] = (pd.scoreSum['__brand__'] || 0) + (run.score || 0)
          }
          // Dedupe canonical brands within this run: best (lowest) rank wins
          const inRun = new Map<string, { isMe: boolean; bestRank: number | null; bestScore: number; names: string[]; sents: string[] }>()
          ;(run.brandMentions || []).forEach(m => {
            const isMe = m.type === 'brand'
            if (!isMe && m.type !== 'competitor') return
            const key = isMe ? '__brand__' : (m.competitorId || m.entityName)
            const cur = inRun.get(key) ?? { isMe, bestRank: null, bestScore: 0, names: [], sents: [] }
            if (typeof m.score === 'number' && m.score > cur.bestScore) cur.bestScore = m.score
            if (typeof m.rank === 'number' && m.rank > 0 && (cur.bestRank === null || m.rank < cur.bestRank)) cur.bestRank = m.rank
            cur.names.push(m.entityName)
            if (m.sentiment) cur.sents.push(m.sentiment.toLowerCase())
            inRun.set(key, cur)
          })
          inRun.forEach((v, key) => {
            mergeInto(agg, key, v)
            mergeInto(aggByModel[model], key, v)
            if (pd) {
              pd.mentions[key] = (pd.mentions[key] || 0) + 1
              // Competitors: best score among this entity's mentions in the run
              if (!v.isMe) pd.scoreSum[key] = (pd.scoreSum[key] || 0) + v.bestScore
            }
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
        const name = (key !== '__brand__' && compNames[key]) || shortBrand(votedName)
        if (keptNames.has(name)) keyName[key] = name
      })

      const timeline: TimelinePoint[] = Object.entries(perDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, pd]) => {
          const values: Record<string, number> = {}
          Object.entries(keyName).forEach(([key, name]) => {
            // Daily Peekaboo-style visibility score: mean run score over ALL of
            // the day's runs (absences count as 0), not the mention rate
            values[name] = pd.runs > 0 ? Math.round((pd.scoreSum[key] || 0) / pd.runs) : 0
          })
          return { date, values }
        })

      return { all, byModel, timeline }
  }, [details, comp, enabled, loading])
}
