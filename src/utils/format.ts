export function formatScore(n: number) {
  return Math.round(n)
}

export function formatPct(n: number) {
  return `${Math.round(n)}%`
}

export function formatDelta(n: number, suffix = '%') {
  const sign = n > 0 ? '+' : ''
  return `${sign}${Math.round(n)}${suffix}`
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatRelativeDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(iso)
}

export function scoreTrend(trend: string): 'up' | 'down' | 'neutral' {
  if (trend === 'up') return 'up'
  if (trend === 'down') return 'down'
  return 'neutral'
}

export function scoreColor(score: number) {
  if (score >= 70) return 'text-brand-success'
  if (score >= 40) return 'text-brand-warning'
  return 'text-brand-danger'
}

export function scoreBg(score: number) {
  if (score >= 70) return 'bg-brand-success/15 text-brand-success'
  if (score >= 40) return 'bg-brand-warning/15 text-brand-warning'
  return 'bg-brand-danger/15 text-brand-danger'
}

export const LLM_DOMAINS: Record<string, string> = {
  'gpt-4o-mini':        'chatgpt.com',
  'gemini-2.5-flash':   'gemini.google.com',
  'google-ai-mode':     'google.com',
  'google-aio':         'google.com',
  'claude-3-5-sonnet':  'claude.ai',
  'perplexity':         'perplexity.ai',
  'sonar':              'perplexity.ai',
}

export function llmDomain(model: string): string | null {
  return LLM_DOMAINS[model] ?? null
}

export const LLM_LABELS: Record<string, string> = {
  'gpt-4o-mini': 'ChatGPT',
  'google-ai-mode': 'Google AI Mode',
  'google-aio': 'Google AIO',
  'gemini-2.5-flash': 'Gemini',
  'claude-3-5-sonnet': 'Claude',
  'perplexity': 'Perplexity',
  'sonar': 'Perplexity',
}

export function llmLabel(model: string) {
  return LLM_LABELS[model] || model
}

export const LLM_COLORS: Record<string, string> = {
  'gpt-4o-mini': '#10A37F',
  'google-ai-mode': '#4285F4',
  'google-aio': '#34A853',
  'gemini-2.5-flash': '#8B5CF6',
  'claude-3-5-sonnet': '#C96442',
  'perplexity': '#06B6D4',
  'sonar': '#22D3EE',
}

export function llmColor(model: string) {
  return LLM_COLORS[model] || '#8B93A9'
}

// MyForce (the brand the dashboard belongs to) — always use this in charts where it appears as a data series
export const MY_BRAND_COLOR = '#EA3624'

// Fixed per-brand colours across the whole dashboard (user-defined)
export const BRAND_COLORS: Record<string, string> = {
  'MyForce': MY_BRAND_COLOR,
  'Midas': '#FFFFFF',
  'Norauto': '#F97316',
  'Bosch Car Service': '#06B6D4',
  'Euromaster': '#84CC16',
  'Feu Vert': '#22C55E',
  'Roady': '#CBD5E1',
}

/** Resolve a brand's fixed colour (fuzzy: matches names like "Oficinas MyForce Portugal") */
export function brandColor(name: string, isMe = false): string {
  if (isMe) return MY_BRAND_COLOR
  const n = name.toLowerCase()
  for (const [key, color] of Object.entries(BRAND_COLORS)) {
    if (n.includes(key.toLowerCase())) return color
  }
  return '#8B93A9'
}

/** Outline for shapes whose fill is too dark to read on the navy background */
export function brandStroke(color: string): string | undefined {
  return color === '#000000' ? 'rgba(255,255,255,0.5)' : undefined
}

// Competitor palette — red-free (MyForce is the only red) and hue-distinct:
// cyan, violet, amber, green, soft rose
export const BRAND_PALETTE = ['#06B6D4', '#8B5CF6', '#F59E0B', '#84CC16', '#F472B6']

export const CATEGORY_COLORS: Record<string, string> = {
  'Content Gap': '#06B6D4',
  'Authority Building': '#8B5CF6',
  'Technical': '#F59E0B',
  'PR': '#DFFF11',
  'GEO': '#EF4444',
  'content': '#06B6D4',
  'authority': '#8B5CF6',
  'technical': '#F59E0B',
  'pr': '#DFFF11',
  'geo': '#EF4444',
}

export function categoryColor(cat: string) {
  return CATEGORY_COLORS[cat] || '#8B93A9'
}

export function truncate(str: string, n: number) {
  return str.length > n ? str.slice(0, n) + '…' : str
}
