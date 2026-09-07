const BASE_URL = '/api-proxy/api/v1'
// Provided at build time: .env.local for local builds/dev, VITE_API_KEY env var
// on Netlify CI builds. Never hardcode the key here — this file is versioned.
const API_KEY = import.meta.env.VITE_API_KEY
if (!API_KEY) throw new Error('VITE_API_KEY is not set — add it to dashboard/.env.local or the Netlify environment')

// Some upstream endpoints (notably /visibility) legitimately take 9–25s, so the
// timeout is generous. Successful responses are cached in localStorage: fresh
// cache (< 6h — data updates daily) is served instantly, and any cache at all
// is served as a fallback when the network fails, so cards never render zero.
const CACHE_FRESH_MS = 6 * 60 * 60 * 1000

// A browser refresh must refresh the WHOLE dashboard: entries written before
// this page load are treated as stale (refetched, kept only as error fallback),
// so every page in the SPA session shows the same coherent snapshot.
const PAGE_LOAD_TS = Date.now()

function readCache<T>(path: string): { t: number; data: T } | null {
  try {
    const raw = localStorage.getItem(`api:${path}`)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function writeCache<T>(path: string, data: T) {
  try { localStorage.setItem(`api:${path}`, JSON.stringify({ t: Date.now(), data })) } catch { /* quota */ }
}

async function apiFetch<T>(path: string, attempt = 0): Promise<T> {
  if (attempt === 0) {
    const cached = readCache<T>(path)
    if (cached && cached.t >= PAGE_LOAD_TS && Date.now() - cached.t < CACHE_FRESH_MS) return cached.data
  }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 35000)
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'X-API-Key': API_KEY },
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`API error ${res.status}: ${path}`)
    const json = await res.json()
    if (!json.success) throw new Error(json.error?.message || 'API error')
    writeCache(path, json.data)
    return json.data as T
  } catch (err) {
    if (attempt < 2) {
      await new Promise(r => setTimeout(r, 800 * (attempt + 1)))
      return apiFetch<T>(path, attempt + 1)
    }
    // All retries exhausted — serve stale cache rather than failing the card
    const stale = readCache<T>(path)
    if (stale) return stale.data
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export const api = {
  brands: () => apiFetch<Brand[]>('/brands'),
  visibility: (brandId: string, timeRange = '30d') =>
    apiFetch<VisibilityData>(`/brands/${brandId}/visibility?time_range=${timeRange}`),
  snapshot: (brandId: string, timeRange = '30d') =>
    apiFetch<SnapshotData>(`/brands/${brandId}/snapshot?time_range=${timeRange}`),
  sources: (brandId: string, timeRange = '30d') =>
    apiFetch<SourcesData>(`/brands/${brandId}/sources?time_range=${timeRange}`),
  competitors: (brandId: string, timeRange = '30d') =>
    apiFetch<CompetitorsData>(`/brands/${brandId}/competitors?time_range=${timeRange}`),
  prompts: (brandId: string, timeRange = '30d') =>
    apiFetch<PromptItem[]>(`/brands/${brandId}/prompts?time_range=${timeRange}&limit=100`),
  promptDetail: (brandId: string, promptId: string, timeRange = '30d') =>
    apiFetch<PromptDetail>(`/brands/${brandId}/prompts/${promptId}?time_range=${timeRange}`),
}

export interface Brand {
  id: string
  name: string
  url: string
  industry: string
  lastAnalysisAt: string
  analysisFrequency: string
}

export interface VisibilityData {
  brand: { id: string; name: string }
  visibility: { score: number; runCount: number; trend: string; timeRange: string }
  marketShare: { percentage: number; totalMentions: number; brandMentions: number }
  topPrompts: TopPrompt[]
  lastAnalysisAt: string
}

export interface TopPrompt {
  prompt: string
  aiModels: string[]
  avgScore: number
  category: string | null
  mentions: number
}

export interface SnapshotData {
  brand: { id: string; name: string }
  snapshotDate: string
  visibility: { score: number; rank: number; maxScore: number; totalCitations: number; totalChatsAnalyzed: number }
  prompts: SnapshotPrompt[]
  sources: SourceItem[]
  competitors: CompetitorItem[]
  aiSuggestions: string[]
  traffic: TrafficData
}

export interface SnapshotPrompt {
  promptText: string
  category: string | null
  mentions: number
  averageScore: number
  aiModels: string[]
}

export interface SourceItem {
  domain: string
  mentions: number
  aiModels: string[]
}

export interface CompetitorItem {
  id: string
  name: string
  url: string
  score: number
  change: string
  monthlyVisits: number | null
  globalRank: number | null
  rank: number
}

export interface TrafficData {
  monthlyVisits: number
  globalRank: number
  countryRank: number
  bounceRate: number
  pagesPerVisit: number
  avgTimeOnSite: number
}

export interface SourcesData {
  sources: SourceItem[]
  summary: { totalDomains: number; totalMentions: number; topDomain: string }
}

export interface CompetitorsData {
  brand: { name: string; score: number; trend: string }
  competitors: CompetitorItem[]
  summary: { totalCompetitors: number; brandRankAmongCompetitors: number; averageCompetitorScore: number }
}

export interface PromptRunSource {
  domain: string
  url: string
  title: string
}

export interface BrandMention {
  entityName: string
  type: 'brand' | 'competitor' | string
  competitorId?: string
  rank: number | null
  score: number
  sentiment: string | null
  mentionSummary?: string
}

export interface PromptRun {
  runId: string
  date: string
  aiModel: string
  score: number
  rank: number | null
  mentioned: boolean
  sentiment: string | null
  responseSnippet: string
  sources: PromptRunSource[]
  brandMentions?: BrandMention[]
}

export interface PromptDetail {
  promptId: string
  promptText: string
  category: string | null
  searchIntent: string | null
  summary: { averageScore: number; totalRuns: number; trend: string }
  history: PromptRun[]
}

export interface PromptItem {
  promptId: string
  promptText: string
  category: string | null
  searchIntent: string | null
  averageScore: number
  bestScore: number
  worstScore: number
  totalRuns: number
  trend: string
}
