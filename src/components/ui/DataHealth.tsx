import { useCallback, useSyncExternalStore } from 'react'
import { AlertTriangle, DatabaseZap } from 'lucide-react'
import { getStaleOldestTs, subscribeStale } from '../../api/client'
import { useDetailHealth } from '../../hooks/useBrandVisibilityStats'

/**
 * Floating notice shown while the prompt-detail batch is incomplete (e.g. the
 * API rate-limited part of it). Background retries keep running; the notice
 * disappears on its own once every prompt is in.
 */
export function PartialDataNotice({ lang = 'en' }: { lang?: 'en' | 'pt' }) {
  const { partial, loaded, total } = useDetailHealth()
  if (!partial) return null
  const text = lang === 'pt'
    ? `Dados parciais (${loaded}/${total} perguntas) — a recarregar…`
    : `Partial data (${loaded}/${total} prompts) — reloading…`
  return (
    <div
      role="status"
      className="fixed bottom-4 right-4 z-[70] flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium shadow-lg"
      style={{ backgroundColor: 'rgba(245,166,35,0.95)', color: '#1A1F2E' }}
    >
      <AlertTriangle size={13} />
      {text}
    </div>
  )
}

function useStaleTs(): number | null {
  const subscribe = useCallback((cb: () => void) => subscribeStale(cb), [])
  return useSyncExternalStore(subscribe, getStaleOldestTs)
}

function ageLabel(ts: number, lang: 'en' | 'pt') {
  const hours = Math.max(Math.floor((Date.now() - ts) / 3600000), 0)
  if (lang === 'pt') return hours < 1 ? 'dados em cache · < 1h' : `dados em cache · há ${hours}h`
  return hours < 1 ? 'cached data · < 1h old' : `cached data · ${hours}h old`
}

/**
 * Small amber badge shown when at least one API call failed and the UI is
 * serving the localStorage fallback — so old numbers are never presented as
 * current without saying so.
 */
export function StaleBadge({ lang = 'en' }: { lang?: 'en' | 'pt' }) {
  const ts = useStaleTs()
  if (ts === null) return null
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-semibold"
      style={{ backgroundColor: 'rgba(245,166,35,0.15)', color: '#F5A623', border: '1px solid rgba(245,166,35,0.4)' }}
      title={lang === 'pt'
        ? 'A API falhou em alguns pedidos; estás a ver os últimos dados guardados.'
        : 'Some API requests failed; you are looking at the last saved data.'}
    >
      <DatabaseZap size={11} />
      {ageLabel(ts, lang)}
    </span>
  )
}
