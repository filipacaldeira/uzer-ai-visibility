import { useState, useMemo } from 'react'
import { Eye, BookOpen, ShieldCheck, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useApi } from '../hooks/useApi'
import { Header } from '../components/layout/Header'
import { ErrorState, PageSkeleton } from '../components/ui/LoadingState'
import { InfoTip } from '../components/ui/InfoTip'

const BRAND_ID = 'c727ae2e-28f3-40f9-8e79-bc83ee402cbb'

const OWNED_DOMAINS = new Set(['myforce.pt'])
const DA_MAP: Record<string, number> = {
  'youtube.com': 99, 'google.com': 100, 'facebook.com': 96, 'reddit.com': 91,
  'instagram.com': 93, 'myforce.pt': 35, 'midas.pt': 42, 'euromaster.pt': 40,
  'feuvert.pt': 38, 'boschcarservice.com': 60, 'acp.pt': 55, 'norauto.pt': 39,
  'caetano.pt': 48, 'carmine.pt': 28, 'auto.pt': 35, 'controlauto.pt': 30,
  'ayvens.com': 52, 'wialon.com': 44, 'prio.pt': 40, 'carglass.pt': 45,
}

// AIX status tiers (from framework):
// 0-39 = Inexistente (red) · 40-69 = Iniciado (amber) · 70-100 = Consolidado (green)
type Tier = 'red' | 'amber' | 'green'
function tierOf(score: number): Tier {
  if (score >= 70) return 'green'
  if (score >= 40) return 'amber'
  return 'red'
}
const TIER_META: Record<Tier, { label: string; color: string; bg: string; glow: string; gradient: string; hex: string }> = {
  green: {
    label: 'Consolidado',
    color: '#DFFF11',
    hex: '#DFFF11',
    bg: 'rgba(223,255,17,0.10)',
    glow: '0 8px 24px -12px rgba(223,255,17,0.4)',
    gradient: 'linear-gradient(135deg, #F0FF6E 0%, #DFFF11 45%, #98C20A 100%)',
  },
  amber: {
    label: 'Iniciado',
    color: '#F59E0B',
    hex: '#F59E0B',
    bg: 'rgba(245,158,11,0.10)',
    glow: '0 8px 24px -12px rgba(245,158,11,0.4)',
    gradient: 'linear-gradient(135deg, #FCD34D 0%, #F59E0B 45%, #B45309 100%)',
  },
  red: {
    label: 'Inexistente',
    color: '#EF4444',
    hex: '#EF4444',
    bg: 'rgba(239,68,68,0.10)',
    glow: '0 8px 24px -12px rgba(239,68,68,0.4)',
    gradient: 'linear-gradient(135deg, #FCA5A5 0%, #EF4444 45%, #991B1B 100%)',
  },
}

export default function AIX() {
  const [timeRange, setTimeRange] = useState('30d')
  const navigate = useNavigate()

  const { data: snap, loading, error, refetch } = useApi(
    () => api.snapshot(BRAND_ID, timeRange), [timeRange]
  )
  const { data: vis } = useApi(
    () => api.visibility(BRAND_ID, timeRange), [timeRange]
  )
  const { data: prompts } = useApi(
    () => api.prompts(BRAND_ID, timeRange), [timeRange]
  )
  const { data: sources } = useApi(
    () => api.sources(BRAND_ID, timeRange), [timeRange]
  )

  // ── VISIBILIDADE ───────────────────────────────────────────
  const visibilidade = useMemo(() => {
    const aiScore     = snap?.visibility.score ?? 0                      // 0-100
    const sov         = vis?.marketShare.percentage ?? 0                 // 0-100 (already %)
    const llmBreadth  = snap ? [...new Set(snap.prompts.flatMap(p => p.aiModels))].length : 0
    const llmScore    = Math.round((llmBreadth / 6) * 100)               // 0-100
    const covered     = (prompts || []).filter(p => p.averageScore > 0).length
    const total       = (prompts || []).length
    const coverage    = total > 0 ? Math.round((covered / total) * 100) : 0

    // Composite: weighted mean of the 4 sub-metrics
    const composite = Math.round(
      aiScore * 0.4 + sov * 0.2 + llmScore * 0.2 + coverage * 0.2
    )

    return {
      score: composite,
      breakdown: [
        { label: 'AI Visibility Score', value: aiScore,   weight: 40, suffix: '/100', hint: 'Score composto agregado — quanto a marca aparece nas respostas de IA em geral.' },
        { label: 'AI Share of Voice',   value: Math.round(sov), weight: 20, suffix: '%',    hint: 'Menções da marca / menções totais de todas as marcas da categoria.' },
        { label: 'LLM Breadth',         value: llmScore,  weight: 20, suffix: `%  (${llmBreadth}/6)`, hint: 'Nº de plataformas de IA onde a marca aparece (ChatGPT, Gemini, AI Mode, AIO, Perplexity, Claude).' },
        { label: 'Prompt Coverage Rate',value: coverage,  weight: 20, suffix: `%  (${covered}/${total})`, hint: 'Percentagem dos prompts monitorizados onde a marca é mencionada pelo menos uma vez.' },
      ],
    }
  }, [snap, vis, prompts])

  // ── LEGIBILIDADE ───────────────────────────────────────────
  const legibilidade = useMemo(() => {
    // 1. Avg score conditional on brand appearing (when found, was it high?)
    const withScore = (prompts || []).filter(p => p.averageScore > 0)
    const avgConditional = withScore.length > 0
      ? Math.round(withScore.reduce((s, p) => s + p.averageScore, 0) / withScore.length)
      : 0

    // 2. Category consistency: % of categories with score > 40 (out of total categories)
    const catMap: Record<string, { total: number; count: number }> = {}
    ;(prompts || []).forEach(p => {
      const cat = p.category || 'Uncategorized'
      if (!catMap[cat]) catMap[cat] = { total: 0, count: 0 }
      catMap[cat].total += p.averageScore
      catMap[cat].count++
    })
    const cats = Object.values(catMap).map(v => v.total / v.count)
    const understoodCats = cats.filter(a => a >= 40).length
    const catConsistency = cats.length > 0 ? Math.round((understoodCats / cats.length) * 100) : 0

    // 3. Owned source share (indicator that brand's own content is being read)
    const totalMentions = sources?.sources.reduce((s, x) => s + x.mentions, 0) || 0
    const ownedMentions = sources?.sources.filter(s => OWNED_DOMAINS.has(s.domain)).reduce((s, x) => s + x.mentions, 0) || 0
    const ownedShare = totalMentions > 0 ? Math.round((ownedMentions / totalMentions) * 100) : 0

    // 4. Anti-hallucination proxy: 100 - white-space rate (prompts run but 0 score)
    const total = (prompts || []).length
    const whiteSpace = (prompts || []).filter(p => p.averageScore === 0 && p.totalRuns > 0).length
    const whiteSpaceRate = total > 0 ? Math.round((whiteSpace / total) * 100) : 0
    const noGap = 100 - whiteSpaceRate

    const composite = Math.round(
      avgConditional * 0.4 + catConsistency * 0.25 + ownedShare * 0.15 + noGap * 0.2
    )

    return {
      score: composite,
      breakdown: [
        { label: 'Avg Score when brand is cited', value: avgConditional, weight: 40, suffix: '/100', hint: 'Média do visibility score nos prompts onde a marca foi mencionada — indica se a IA acerta na resposta.' },
        { label: 'Category Consistency',          value: catConsistency, weight: 25, suffix: `%  (${understoodCats}/${cats.length})`, hint: 'Percentagem de categorias de prompts onde a marca é bem compreendida (score médio ≥ 40).' },
        { label: 'Owned Source Share',            value: ownedShare,     weight: 15, suffix: '%', hint: 'Quota de citações vindas de domínios da própria marca — sinal de que os assets estão legíveis para a IA.' },
        { label: 'No White-Space Rate',           value: noGap,          weight: 20, suffix: `%  (${whiteSpace} gaps)`, hint: 'Inverso da % de prompts corridos mas com score 0 — indica que a IA relaciona a marca com o tópico.' },
      ],
    }
  }, [prompts, sources])

  // ── CREDIBILIDADE ──────────────────────────────────────────
  const credibilidade = useMemo(() => {
    const list = sources?.sources || []
    const totalMentions = list.reduce((s, x) => s + x.mentions, 0)

    // 1. Source Authority Score — weighted average DA
    const weightedDA = totalMentions > 0
      ? Math.round(list.reduce((s, x) => s + (DA_MAP[x.domain] || 40) * x.mentions, 0) / totalMentions)
      : 0

    // 2. Domain diversity — 100 - concentration risk on top 5
    const sorted = [...list].sort((a, b) => b.mentions - a.mentions)
    const top5Mentions = sorted.slice(0, 5).reduce((s, x) => s + x.mentions, 0)
    const concentration = totalMentions > 0 ? Math.round((top5Mentions / totalMentions) * 100) : 0
    const diversity = 100 - concentration

    // 3. Unique domains (capped normalization: ≥ 30 unique = 100)
    const uniqueDomains = sources?.summary.totalDomains || 0
    const uniqueScore = Math.min(Math.round((uniqueDomains / 30) * 100), 100)

    // 4. Trusted source mix — high-DA share (DA ≥ 60)
    const trustedMentions = list.filter(x => (DA_MAP[x.domain] || 40) >= 60).reduce((s, x) => s + x.mentions, 0)
    const trustedShare = totalMentions > 0 ? Math.round((trustedMentions / totalMentions) * 100) : 0

    const composite = Math.round(
      weightedDA * 0.4 + diversity * 0.25 + uniqueScore * 0.15 + trustedShare * 0.2
    )

    return {
      score: composite,
      breakdown: [
        { label: 'Source Authority Score', value: weightedDA,   weight: 40, suffix: '/100 DA', hint: 'Média ponderada da Domain Authority das fontes que citam a marca (por número de menções).' },
        { label: 'Source Diversity',       value: diversity,    weight: 25, suffix: `%  (top5 = ${concentration}%)`, hint: '100 menos a concentração das top 5 fontes. Quanto mais espalhado, mais robusto.' },
        { label: 'Unique Domains',         value: uniqueScore,  weight: 15, suffix: `%  (${uniqueDomains})`, hint: 'Nº de domínios distintos que citam a marca, normalizado (≥ 30 = 100%).' },
        { label: 'Trusted Source Share',   value: trustedShare, weight: 20, suffix: '%', hint: 'Percentagem de menções vindas de domínios de alta autoridade (DA ≥ 60).' },
      ],
    }
  }, [sources])

  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (loading) return <><Header title="AIR Framework" timeRange={timeRange} onTimeRangeChange={setTimeRange} /><PageSkeleton /></>

  const pillars = [
    {
      key: 'visibility' as const,
      title: 'Visibilidade',
      subtitle: 'A IA encontra a marca?',
      icon: Eye,
      data: visibilidade,
      description: 'O que permite à IA encontrar a marca: activos próprios (páginas por serviço/localização, FAQ), activos externos (directórios, rankings, Google Business, YouTube) e canais pagos com impacto indirecto.',
      linkTo: '/by-llm',
      linkLabel: 'Ver por LLM',
    },
    {
      key: 'readability' as const,
      title: 'Legibilidade',
      subtitle: 'A IA compreende a marca?',
      icon: BookOpen,
      data: legibilidade,
      description: 'O que permite à IA compreender a marca: identidade & entidade (nome, categoria, moradas consistentes; ligações site ↔ Google Business ↔ Wikidata) e estrutura & conteúdo legível (schema.org, HTML indexável, páginas por serviço/intenção).',
      linkTo: '/by-prompt',
      linkLabel: 'Ver por prompt',
    },
    {
      key: 'credibility' as const,
      title: 'Credibilidade',
      subtitle: 'A IA confia na marca?',
      icon: ShieldCheck,
      data: credibilidade,
      description: 'O que permite à IA confiar na marca: autoridade externa (imprensa, rankings, podcasts, prémios) e prova social & consenso (reviews, testemunhos, menções em Reddit/Quora/fóruns, recomendações orgânicas).',
      linkTo: '/sources',
      linkLabel: 'Ver sources',
    },
  ]

  return (
    <div className="space-y-6">
      <Header
        title="AIR — AI Visibility Index"
        subtitle="Framework UZER: Visibilidade · Legibilidade · Credibilidade — os 3 pilares que permitem a uma marca ser encontrada, compreendida e recomendada por IA"
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
      />

      {/* Three pillar hero cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {pillars.map(pillar => {
          const t = tierOf(pillar.data.score)
          const meta = TIER_META[t]
          const Icon = pillar.icon
          return (
            <div
              key={pillar.key}
              className="rounded-2xl p-6 relative overflow-hidden flex flex-col"
              style={{
                background: meta.gradient,
                color: '#0B0F1A',
                boxShadow: meta.glow,
              }}
            >
              <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full opacity-30" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.55) 0%, transparent 70%)' }} />
              <div className="absolute -bottom-16 -left-10 w-40 h-40 rounded-full opacity-25" style={{ background: 'radial-gradient(circle, rgba(11,15,26,0.5) 0%, transparent 70%)' }} />
              <div className="flex items-center justify-between mb-3 relative">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(11,15,26,0.15)' }}>
                    <Icon size={18} style={{ color: '#0B0F1A' }} strokeWidth={2.2} />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest opacity-75">{pillar.title}</p>
                    <p className="text-2xs opacity-70">{pillar.subtitle}</p>
                  </div>
                </div>
                <span className="text-2xs font-bold uppercase tracking-wider px-2 py-1 rounded-full" style={{ backgroundColor: 'rgba(11,15,26,0.18)' }}>
                  {meta.label}
                </span>
              </div>
              <div className="flex items-end gap-2 relative">
                <div className="text-6xl font-extrabold leading-none tracking-tight">{pillar.data.score}</div>
                <div className="text-xl font-semibold opacity-60 pb-1.5">/100</div>
              </div>
              <div className="mt-3 text-xs font-medium opacity-80 leading-snug relative">
                {pillar.description}
              </div>
              <button
                onClick={() => navigate(pillar.linkTo)}
                className="mt-3 self-start flex items-center gap-1.5 text-2xs font-bold px-3 py-1.5 rounded-full transition-transform hover:scale-105 relative"
                style={{ backgroundColor: 'rgba(11,15,26,0.85)', color: meta.hex }}
              >
                {pillar.linkLabel} <ArrowRight size={12} />
              </button>
            </div>
          )
        })}
      </div>

      {/* Breakdown per pillar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {pillars.map(pillar => {
          const t = tierOf(pillar.data.score)
          const meta = TIER_META[t]
          return (
            <div key={pillar.key} className="card">
              <p className="section-title inline-flex items-center gap-1.5">
                {pillar.title} — Breakdown
                <InfoTip text={`Sub-métricas que compõem o score de ${pillar.title}. Cada uma tem um peso na fórmula agregada.`} />
              </p>
              <div className="space-y-4">
                {pillar.data.breakdown.map(m => {
                  const subTier = tierOf(m.value)
                  const subMeta = TIER_META[subTier]
                  return (
                    <div key={m.label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-brand-text font-medium inline-flex items-center gap-1.5">
                          {m.label}
                          <InfoTip text={m.hint} />
                        </span>
                        <span className="text-2xs font-bold" style={{ color: subMeta.hex }}>
                          {m.value}{m.suffix}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min(m.value, 100)}%`, backgroundColor: subMeta.hex }} />
                      </div>
                      <div className="mt-1 text-2xs text-brand-dim">weight {m.weight}%</div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 pt-3 border-t border-brand-border flex items-center justify-between">
                <span className="text-2xs text-brand-muted">Estado</span>
                <span className="text-2xs font-bold uppercase tracking-widest" style={{ color: meta.hex }}>
                  {meta.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Framework key */}
      <div className="card">
        <p className="section-title inline-flex items-center gap-1.5">
          Como interpretar
          <InfoTip text="Codificação de cor do framework AIR. Aplicada a cada score composto e sub-métrica." />
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(['red', 'amber', 'green'] as const).map(t => {
            const meta = TIER_META[t]
            const range = t === 'red' ? '0–39' : t === 'amber' ? '40–69' : '70–100'
            const desc =
              t === 'red' ? 'Ainda não há sinal detectável — activo, conteúdo ou fonte por criar.'
              : t === 'amber' ? 'Existência básica — necessita optimização e reforço.'
              : 'Presença sólida, consistente e reconhecida pela IA.'
            return (
              <div key={t} className="rounded-xl p-4" style={{ backgroundColor: meta.bg, border: `1px solid ${meta.hex}40` }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.hex }} />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: meta.hex }}>{meta.label}</span>
                  <span className="text-2xs text-brand-dim ml-auto">{range}</span>
                </div>
                <p className="text-xs text-brand-muted leading-snug">{desc}</p>
              </div>
            )
          })}
        </div>
        <p className="text-2xs text-brand-dim mt-4 leading-relaxed">
          Modelo proprietário <span className="text-brand-text font-semibold">UZER Consulting</span> — AIR Framework V4.
          A camada de IA (ChatGPT · Perplexity · Gemini · Claude · Copilot · Google AI Mode · AI Overviews)
          não é um ambiente, é uma camada permanente que medeia cada vez mais a relação entre marcas e pessoas.
          O AIR responde a 3 perguntas fundamentais: <span className="text-brand-text">A IA encontra a marca?</span> ·
          <span className="text-brand-text"> A IA compreende a marca?</span> ·
          <span className="text-brand-text"> A IA confia na marca?</span>
        </p>
      </div>
    </div>
  )
}
