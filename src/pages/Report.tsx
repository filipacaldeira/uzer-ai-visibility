import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useReportData, type ReportData } from '../report/useReportData'
import { autoHeadline } from '../report/headlines'
import { llmDomain, brandColor } from '../utils/format'
import { Favicon } from '../components/ui/Favicon'
import factsFlags from '../data/myforce_facts_flags.json'
import { PartialDataNotice, StaleBadge } from '../components/ui/DataHealth'

// UZER Ethereal Flux tokens (design skill)
const T = {
  navy: '#0B1326', ink: '#10182E', body: '#3C3C3C', muted: '#5A6378',
  border: '#E3E5EE', purple: '#8B5CF6', cyan: '#06B6D4', lime: '#DFFF11',
  green: '#30A46C', amber: '#F5A623', red: '#E5484D',
  bar: '#EA3624', barComp: '#9DA5BC', paper: '#F5F6FA', brandRed: '#EA3624',
}

// 3.689 — thousands with a dot (user rule)
const fmtInt = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
// 1.9º / 2º — ordinal without the dot before º
const fmtPos = (n: number) => `${n}º`

const OVERRIDES_KEY = 'report-headline-overrides'
const SCREEN_IDS = ['capa', 'sumario', 'score', 'sov', 'servicos', 'rankings', 'perguntas', 'motores', 'intencoes', 'narrativa', 'fontes', 'dominios']
const TOTAL_SCREENS = SCREEN_IDS.length

function readOverrides(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(OVERRIDES_KEY) || '{}') } catch { return {} }
}

/* ---------- shared building blocks ---------- */

function Eyebrow({ children, dark = false }: { children: string; dark?: boolean }) {
  return (
    <div style={{
      color: dark ? T.lime : T.purple, fontSize: 17, letterSpacing: '0.32em',
      textTransform: 'uppercase', fontWeight: 700, marginBottom: 14, fontFamily: 'Inter, sans-serif',
    }}>{children}</div>
  )
}

function Headline({ id, data, dark = false, size = 34 }: { id: string; data: ReportData; dark?: boolean; size?: number }) {
  const [overrides, setOverrides] = useState<Record<string, string>>(readOverrides)
  const auto = autoHeadline(id, data)
  const text = overrides[id] ?? auto
  const ref = useRef<HTMLHeadingElement>(null)

  const save = useCallback(() => {
    const cur = ref.current?.innerText?.trim() || ''
    setOverrides(prev => {
      const next = { ...prev }
      if (!cur || cur === auto) delete next[id]
      else next[id] = cur
      try { localStorage.setItem(OVERRIDES_KEY, JSON.stringify(next)) } catch { /* quota */ }
      return next
    })
  }, [auto, id])

  const reset = () => {
    setOverrides(prev => {
      const next = { ...prev }; delete next[id]
      try { localStorage.setItem(OVERRIDES_KEY, JSON.stringify(next)) } catch { /* quota */ }
      return next
    })
    if (ref.current) ref.current.innerText = auto
  }

  return (
    <div style={{ position: 'relative' }}>
      <h2
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onBlur={save}
        style={{
          fontFamily: 'Inter, sans-serif', fontWeight: 300, fontSize: size, lineHeight: 1.25,
          color: dark ? '#F2F4FB' : T.ink, margin: 0, outline: 'none', maxWidth: 980,
        }}
      >{text}</h2>
      {overrides[id] != null && (
        <button
          onClick={reset}
          className="report-noprint"
          style={{
            position: 'absolute', right: -8, top: -22, fontSize: 10, color: T.purple,
            background: 'none', border: `1px solid ${T.purple}44`, borderRadius: 999,
            padding: '2px 10px', cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase',
          }}
        >repor automático</button>
      )}
    </div>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: '#FFFFFF', border: `1px solid ${T.border}`, borderRadius: 14,
      boxShadow: '0 3px 9px rgba(26,35,64,0.10)', padding: '20px 24px', ...style,
    }}>{children}</div>
  )
}

function HBar({ label, value, max, isMe, right, sub }: {
  label: React.ReactNode; value: number; max: number; isMe?: boolean; right?: React.ReactNode; sub?: React.ReactNode
}) {
  const w = max > 0 ? Math.max((value / max) * 100, 2) : 0
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 150, fontSize: 13, color: isMe ? T.ink : T.muted, fontWeight: isMe ? 600 : 400, flexShrink: 0 }}>{label}</div>
        <div style={{ flex: 1, height: 16, background: '#EEF0F6', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ width: `${w}%`, height: '100%', background: isMe ? T.bar : T.barComp, borderRadius: 8 }} />
        </div>
        <div style={{ width: 90, textAlign: 'right', fontSize: 13, fontWeight: 600, color: isMe ? T.ink : T.muted }}>{right}</div>
      </div>
      {sub && <div style={{ marginLeft: 162, fontSize: 11, color: T.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function Footer({ n, source }: { n: number; source: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 18,
      fontSize: 11, color: T.muted,
    }}>
      <span>{source}</span>
      <span>{n} / {TOTAL_SCREENS}</span>
    </div>
  )
}

function Screen({ id, n, eyebrow, data, children, source }: {
  id: string; n: number; eyebrow: string; data: ReportData; children: React.ReactNode; source: string
}) {
  return (
    <section id={`screen-${id}`} className="report-screen" style={{ background: T.paper }}>
      <img src="/report/uzer_logo_navy.png" alt="UZER" style={{ position: 'absolute', top: 26, right: 34, width: 86 }} />
      <div style={{ maxWidth: 1080, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <Headline id={id} data={data} />
        <div style={{ marginTop: 26, flex: 1, display: 'flex', flexDirection: 'column' }}>{children}</div>
        <Footer n={n} source={source} />
      </div>
    </section>
  )
}

/* ---------- gauge + donut ---------- */

function Gauge({ score }: { score: number }) {
  const r = 80, cx = 100, cy = 100
  const arc = (from: number, to: number, color: string, width = 14) => {
    const a1 = Math.PI * (1 - from / 100), a2 = Math.PI * (1 - to / 100)
    const x1 = cx + r * Math.cos(a1), y1 = cy - r * Math.sin(a1)
    const x2 = cx + r * Math.cos(a2), y2 = cy - r * Math.sin(a2)
    return <path d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`} stroke={color} strokeWidth={width} fill="none" strokeLinecap="butt" />
  }
  const na = Math.PI * (1 - score / 100)
  const nx = cx + (r - 24) * Math.cos(na), ny = cy - (r - 24) * Math.sin(na)
  return (
    <svg viewBox="0 0 200 110" style={{ width: 240 }}>
      {arc(0, 39, `${T.red}33`)}
      {arc(39, 69, `${T.amber}33`)}
      {arc(69, 100, `${T.green}33`)}
      {arc(0, Math.max(score, 2), score >= 70 ? T.green : score >= 40 ? T.amber : T.red)}
      <circle cx={nx} cy={ny} r={5} fill={T.ink} />
      <text x={12} y={108} fontSize={9} fill={T.muted}>0</text>
      <text x={182} y={108} fontSize={9} fill={T.muted}>100</text>
    </svg>
  )
}

function Donut({ owned, earned, competitor }: { owned: number; earned: number; competitor: number }) {
  const segs = [
    { v: owned, c: T.navy, label: 'Próprias' },
    { v: earned, c: T.cyan, label: 'Terceiros' },
    { v: competitor, c: T.barComp, label: 'Concorrentes' },
  ]
  const R = 44, C = 2 * Math.PI * R
  let off = 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
      <svg viewBox="0 0 120 120" style={{ width: 150 }}>
        {segs.map((s, i) => {
          const len = (s.v / 100) * C
          const el = (
            <circle key={i} cx={60} cy={60} r={R} fill="none" stroke={s.c} strokeWidth={16}
              strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} transform="rotate(-90 60 60)" />
          )
          off += len
          return el
        })}
      </svg>
      <div style={{ fontSize: 12.5, color: T.body, display: 'grid', gap: 6 }}>
        {segs.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.c, display: 'inline-block' }} />
            <span>{s.label}</span>
            <strong style={{ color: T.ink }}>{s.v}%</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

function SovDonut({ rows, brand }: { rows: Array<{ name: string; score: number; isMe: boolean }>; brand: string }) {
  const total = rows.reduce((sum, r) => sum + r.score, 0)
  const segs = rows.map(r => ({
    name: r.name, isMe: r.isMe,
    pct: total > 0 ? Math.round((r.score / total) * 100) : 0,
    color: r.isMe ? '#EA3624' : brandColor(r.name),
  }))
  const R = 52, C = 2 * Math.PI * R
  let off = 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      <svg viewBox="0 0 140 140" style={{ width: 170 }}>
        {segs.map((sg, i) => {
          const len = (sg.pct / 100) * C
          const el = (
            <circle key={i} cx={70} cy={70} r={R} fill="none" stroke={sg.color} strokeWidth={18}
              strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} transform="rotate(-90 70 70)"
              strokeOpacity={sg.isMe ? 1 : 0.85} />
          )
          off += len
          return el
        })}
        <text x={70} y={66} textAnchor="middle" fontSize={20} fontWeight={600} fill={T.ink}>{segs.find(sg => sg.isMe)?.pct}%</text>
        <text x={70} y={82} textAnchor="middle" fontSize={9} fill={T.muted}>{brand}</text>
      </svg>
      <div style={{ fontSize: 11.5, color: T.body, display: 'grid', gap: 4 }}>
        {segs.map(sg => (
          <div key={sg.name} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: sg.color, display: 'inline-block', border: sg.color === '#FFFFFF' ? `1px solid ${T.border}` : 'none' }} />
            <span style={{ fontWeight: sg.isMe ? 700 : 400, color: sg.isMe ? T.ink : T.body }}>{sg.name}</span>
            <strong style={{ color: T.ink }}>{sg.pct}%</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------- the report ---------- */

const SOURCE = 'Fonte: Peekaboo · análise de respostas de IA'

export default function Report() {
  const navigate = useNavigate()
  const [timeRange, setTimeRange] = useState('30d')
  const { data, loading, error } = useReportData(timeRange)
  const [active, setActive] = useState(0)

  const goTo = useCallback((i: number) => {
    const el = document.querySelectorAll('.report-screen')[i]
    el?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.isContentEditable) return
      if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); goTo(Math.min(active + 1, TOTAL_SCREENS - 1)) }
      if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); goTo(Math.max(active - 1, 0)) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, goTo])

  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          const idx = Array.from(document.querySelectorAll('.report-screen')).indexOf(en.target)
          if (idx >= 0) setActive(idx)
        }
      })
    }, { threshold: 0.55 })
    document.querySelectorAll('.report-screen').forEach(s => obs.observe(s))
    return () => obs.disconnect()
  }, [data])

  if (error) return <div style={{ padding: 60, fontFamily: 'Inter, sans-serif', color: T.ink }}>Erro ao carregar o relatório: {error}</div>
  if (loading || !data) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.navy, color: '#F2F4FB', fontFamily: 'Inter, sans-serif', flexDirection: 'column', gap: 16 }}>
        <img src="/report/uzer_logo_white.png" alt="UZER" style={{ width: 130, opacity: 0.9 }} />
        <div style={{ fontWeight: 300, letterSpacing: '0.2em', fontSize: 13, textTransform: 'uppercase' }}>A preparar o relatório…</div>
        <div style={{ fontSize: 11, color: '#9AA3BD' }}>a analisar o histórico de respostas de IA (até 1 minuto)</div>
      </div>
    )
  }

  const d = data
  const maxSov = Math.max(...d.sovRows.map(r => r.score), 1)
  const maxTopic = Math.max(...d.topicRows.map(r => r.avgScore), 1)
  const maxIntent = Math.max(...d.intentRows.map(r => r.avgScore), 1)
  const weakTopics = [...d.topicRows].sort((a, b) => a.avgScore - b.avgScore).slice(0, 3)
  const bestTopic = d.topicRows[0]
  const flags = (factsFlags as { flags: Array<{ text: string }> }).flags

  const thStyle: React.CSSProperties = { background: T.cyan, color: '#fff', fontSize: 11.5, fontWeight: 600, padding: '8px 12px', textAlign: 'left' }
  const tdStyle: React.CSSProperties = { padding: '9px 12px', fontSize: 12.5, color: T.body, borderBottom: `1px solid ${T.border}` }

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', background: T.paper }}>
      <PartialDataNotice lang="pt" />
      <style>{`
        .report-screen { min-height: 92vh; position: relative; display: flex; flex-direction: column; padding: 56px 64px 30px; box-sizing: border-box; }
        .report-screen h2[contenteditable]:hover { box-shadow: 0 2px 0 ${T.purple}55; }
        .report-grid { display: grid; gap: 16px; } .report-grid > * { min-width: 0; }
        @media (max-width: 1120px) {
          .report-grid { grid-template-columns: 1fr !important; }
          .report-screen { padding: 40px 28px 24px; }
        }
        .report-tablewrap { overflow-x: auto; }
        @media print {
          @page { size: A4 landscape; margin: 0; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .report-noprint, .report-rail, .report-toolbar, .report-close { display: none !important; }
          .report-screen { min-height: auto; height: 210mm; max-height: 210mm; page-break-after: always; break-after: page; overflow: hidden; padding: 12mm 14mm 8mm; }
          .report-screen:last-of-type { page-break-after: auto; }
          body { background: #fff; }
        }
      `}</style>

      {/* fechar */}
      <button
        className="report-close"
        onClick={() => navigate('/')}
        title="Fechar report e voltar ao dashboard"
        style={{
          position: 'fixed', top: 16, right: 18, zIndex: 60, width: 34, height: 34, borderRadius: '50%',
          background: 'rgba(11,19,38,0.85)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)',
          fontSize: 15, cursor: 'pointer', lineHeight: 1,
        }}
      >✕</button>

      {/* toolbar */}
      <div className="report-toolbar" style={{
        position: 'fixed', bottom: 18, left: 24, zIndex: 50, display: 'flex', gap: 10, alignItems: 'center', background: 'rgba(255,255,255,0.92)', borderRadius: 12, padding: '8px 10px', boxShadow: '0 3px 12px rgba(11,19,38,0.18)',
      }}>
        <select value={timeRange} onChange={e => setTimeRange(e.target.value)}
          style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 8, padding: '6px 10px', fontSize: 12, color: T.ink }}>
          <option value="7d">Últimos 7 dias</option>
          <option value="30d">Últimos 30 dias</option>
          <option value="90d">Últimos 90 dias</option>
        </select>
        <button onClick={() => document.documentElement.requestFullscreen?.()}
          style={{ background: T.navy, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>
          Apresentar
        </button>
        <StaleBadge lang="pt" />
        <button onClick={() => window.print()}
          style={{ background: T.lime, color: T.navy, border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          Exportar PDF
        </button>
      </div>

      {/* dot rail */}
      <div className="report-rail" style={{
        position: 'fixed', right: 20, top: '50%', transform: 'translateY(-50%)', zIndex: 50,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {SCREEN_IDS.map((id, i) => (
          <button key={id} onClick={() => goTo(i)} aria-label={`Ecrã ${i + 1}`} style={{
            width: 9, height: 9, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0,
            background: active === i ? T.purple : '#C3C9DA', transition: 'background .2s',
          }} />
        ))}
      </div>

      {/* 1 — CAPA (hero escuro) */}
      <section id="screen-capa" className="report-screen" style={{
        background: `${T.navy} url(/report/bg_dark_hero.png) center/cover no-repeat`, color: '#F2F4FB', justifyContent: 'center',
      }}>
        <div style={{ position: 'absolute', top: 34, left: 64, display: 'flex', alignItems: 'center', gap: 18 }}>
          <img src="/report/uzer_logo_white.png" alt="UZER" style={{ width: 120 }} />
          <span style={{ color: T.lime, fontSize: 12, letterSpacing: '0.35em', textTransform: 'uppercase' }}>AI Visibility Report</span>
        </div>
        <div style={{ maxWidth: 1080, margin: '0 auto', width: '100%' }}>
          <span style={{ background: T.lime, color: T.navy, fontWeight: 700, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', borderRadius: 6, padding: '5px 12px' }}>{d.brand}</span>
          <div style={{ height: 22 }} />
          <Headline id="capa" data={d} dark size={42} />
          <div style={{ marginTop: 26, color: T.cyan, fontSize: 13.5, display: 'flex', gap: 26, flexWrap: 'wrap' }}>
            <span>{d.periodLabel}</span>
            <span>{d.promptCount} perguntas monitorizadas</span>
            <span>{fmtInt(d.totalRuns)} respostas de IA analisadas</span>
          </div>
          <div style={{ marginTop: 18, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {d.models.map(m => {
              const dom = llmDomain(m)
              return (
                <span key={m} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 999, padding: '5px 12px', fontSize: 11.5, color: '#C9D2E8' }}>
                  {dom && <Favicon domain={dom} size={13} />}{m === 'sonar' ? 'Perplexity' : m === 'google-aio' ? 'AI Overviews' : m === 'google-ai-mode' ? 'AI Mode' : m === 'gpt-4o-mini' ? 'ChatGPT' : m === 'gemini-2.5-flash' ? 'Gemini' : m}
                </span>
              )
            })}
          </div>
          <div style={{ position: 'absolute', bottom: 30, right: 64, fontSize: 11, color: '#9AA3BD', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Powered by UZER</div>
        </div>
      </section>

      {/* 2 — SUMÁRIO EXECUTIVO */}
      <Screen id="sumario" n={2} eyebrow="Sumário executivo" data={d} source={SOURCE}>
        <div className="report-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {[{
            k: 'Posição', txt: <>A {d.brand} tem um score de visibilidade de <strong>{d.score}/100</strong> e é a <strong>{d.rank}.ª marca</strong> mais visível da categoria nas respostas de IA.</>,
          }, {
            k: 'Força', txt: <>{bestTopic ? <>Em <strong>{bestTopic.topic}</strong> a marca atinge score {bestTopic.avgScore}</> : 'O melhor tópico destaca-se'} e <strong>{d.myPositive}%</strong> das menções à {d.brand} têm sentimento positivo.</>,
          }, {
            k: 'Fragilidade', txt: <>Em <strong>{d.zeroCount} das {d.promptCount} perguntas</strong> a {d.brand} não aparece de todo, e apenas <strong>{d.donut.owned}%</strong> das fontes citadas são páginas próprias.</>,
          }, {
            k: 'Oportunidade', txt: d.intentGap ? <>Nas perguntas <strong>{d.intentGap.intent === 'Commercial' ? 'comerciais' : d.intentGap.intent === 'Transactional' ? 'transacionais' : 'informativas'}</strong>, a {d.intentGap.compName} aparece em mais <strong>{d.intentGap.gap} pts</strong> de respostas do que a {d.brand}.</> : <>Fechar o gap nas intenções onde a concorrência domina.</>,
          }].map(b => (
            <Card key={b.k}>
              <div style={{ color: T.purple, fontSize: 11, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 8 }}>{b.k}</div>
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: T.body }}>{b.txt}</p>
            </Card>
          ))}
        </div>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 14 }}>Métricas: score de visibilidade (0–100, pondera presença e destaque da marca nas respostas de IA) · sentimento = % de menções positivas · fontes próprias = citações de domínios da marca.</div>
      </Screen>

      {/* 3 — SCORE */}
      <Screen id="score" n={3} eyebrow="Visibility Score" data={d} source={`${SOURCE} · ${fmtInt(d.totalRuns)} respostas`}>
        <div className="report-grid" style={{ gridTemplateColumns: '1fr 1.05fr' }}>
          <Card style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 22, padding: '28px 34px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
              <div>
                <div style={{ fontSize: 76, fontWeight: 100, color: T.ink, lineHeight: 1 }}>{d.score}<span style={{ fontSize: 26, color: T.muted }}>/100</span></div>
                <div style={{ fontSize: 12.5, color: T.muted, marginTop: 6 }}>score de visibilidade em IA</div>
              </div>
              <Gauge score={d.score} />
            </div>
            <div style={{ display: 'flex', gap: 34, flexWrap: 'wrap' }}>
              {d.avgPosition != null && (
                <div><div style={{ fontSize: 24, fontWeight: 300, color: T.ink }}>{fmtPos(d.avgPosition)}</div><div style={{ fontSize: 12, color: T.muted }}>posição média quando citada</div></div>
              )}
              <div><div style={{ fontSize: 24, fontWeight: 300, color: T.ink }}>{fmtInt(d.totalRuns)}</div><div style={{ fontSize: 12, color: T.muted }}>respostas analisadas</div></div>
              <div style={{ alignSelf: 'end', fontSize: 11.5, color: T.muted, paddingBottom: 2 }}>Tendência: {d.trend === 'up' ? 'a subir' : d.trend === 'down' ? 'a descer' : 'estável'}</div>
            </div>
          </Card>
          <Card style={{ display: 'flex', flexDirection: 'column', padding: '16px 18px' }}>
            <img
              src="/report/peekaboo_visibility.png"
              alt="Visibilidade por marca ao longo do tempo (Peekaboo)"
              style={{ width: '100%', maxHeight: 380, objectFit: 'contain', borderRadius: 8 }}
            />
            <div style={{ fontSize: 11, color: T.muted, marginTop: 8 }}>% de respostas de IA que mencionam cada marca, 8 Jun – 7 Set · captura da plataforma Peekaboo (histórico completo de 90 dias)</div>
          </Card>
        </div>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 14 }}>Métrica: score de visibilidade Peekaboo (0–100) — média do score de todas as respostas de IA do período; cada resposta pontua pela presença e destaque da marca (0 quando ausente). Posição média = ordem em que a marca surge quando é mencionada.</div>
      </Screen>

      {/* 4 — SHARE OF VOICE */}
      <Screen id="sov" n={4} eyebrow="Share of voice" data={d} source={SOURCE}>
        <div className="report-grid" style={{ gridTemplateColumns: '1.25fr 1fr' }}>
          <Card>
            {d.sovRows.map(r => (
              <HBar key={r.name} label={r.name} value={r.score} max={maxSov} isMe={r.isMe} right={`${r.score}/100`} />
            ))}
            <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>Média dos concorrentes: <strong style={{ color: T.ink }}>{d.avgCompScore}</strong> · score de visibilidade em IA (0–100)</div>
          </Card>
          <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Share of voice</div>
            <SovDonut rows={d.sovRows} brand={d.brand} />
          </Card>
        </div>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 14 }}>Métricas: barras = visibilidade em IA por marca (0–100), a mesma métrica do dashboard (% de respostas que mencionam a marca, calibrada ao score oficial da Peekaboo) · donut = share of voice, o peso de cada marca no total das 7.</div>
      </Screen>

      {/* 5 — SERVIÇOS */}
      <Screen id="servicos" n={5} eyebrow="Serviços" data={d} source={SOURCE}>
        <div className="report-grid" style={{ gridTemplateColumns: '1.15fr 1fr' }}>
          <Card>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Score da {d.brand} e posição competitiva por tópico</div>
            {[...d.topicRows].sort((a, b) => b.avgScore - a.avgScore).map(t => (
              <div key={t.topic} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 110, fontSize: 13, color: T.ink, fontWeight: 600, flexShrink: 0 }}>{t.topic}</div>
                  {t.myRank != null && (
                    <span style={{
                      fontSize: 10.5, fontWeight: 700, borderRadius: 999, padding: '2px 9px', flexShrink: 0,
                      background: t.myRank === 1 ? `${T.green}1f` : t.myRank <= 3 ? `${T.amber}22` : `${T.red}1a`,
                      color: t.myRank === 1 ? T.green : t.myRank <= 3 ? '#A87413' : T.red,
                    }}>{fmtPos(t.myRank)}</span>
                  )}
                  <div style={{ flex: 1, height: 14, background: '#EEF0F6', borderRadius: 7, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max((t.avgScore / Math.max(maxTopic, 1)) * 100, 2)}%`, height: '100%', background: T.brandRed, borderRadius: 7 }} />
                  </div>
                  <div style={{ width: 34, textAlign: 'right', fontSize: 13, fontWeight: 600, color: T.ink }}>{t.avgScore}</div>
                </div>
                <div style={{ marginLeft: 120, fontSize: 11, color: T.muted, marginTop: 3 }}>
                  presença em {t.present} de {t.nPrompts} perguntas
                  {t.ranked.length > 0 && <> · líder: <strong style={{ color: t.ranked[0].isMe ? T.brandRed : T.ink }}>{t.ranked[0].name}</strong> ({t.ranked[0].vis}%)</>}
                </div>
              </div>
            ))}
            <div style={{ fontSize: 11, color: T.muted }}>Barra = score médio da {d.brand} (0–100) · badge = posição da {d.brand} no ranking de presença do tópico</div>
          </Card>
          <Card>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Visibilidade por tópico</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[...d.topicRows].sort((a, b) => b.nPrompts - a.nPrompts).map(t => {
                const fill = t.myVis >= 70 ? T.green : t.myVis >= 40 ? T.amber : T.red
                const txt = t.myVis >= 40 && t.myVis < 70 ? T.navy : '#FDF8FC'
                const size = 72 + Math.round(Math.sqrt(t.nPrompts) * 26)
                return (
                  <div key={t.topic} style={{
                    width: size, height: Math.round(size * 0.72), borderRadius: 10, background: fill, color: txt,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                    border: '1.5px solid rgba(11,19,38,0.35)',
                  }}>
                    <span style={{ fontSize: size > 130 ? 13 : 10.5, fontWeight: 600, textAlign: 'center', padding: '0 6px' }}>{t.topic}</span>
                    <span style={{ fontSize: size > 130 ? 15 : 12, fontWeight: 700 }}>{t.myVis}%</span>
                  </div>
                )
              })}
            </div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 12 }}>% de respostas do tópico que mencionam a {d.brand} · tamanho = nº de perguntas · verde ≥ 70, âmbar 40–69, vermelho &lt; 40</div>
            <div style={{ marginTop: 14, borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
              {[...d.topicRows].sort((a, b) => b.avgScore - a.avgScore).map(t => (
                <div key={t.topic} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: T.body, padding: '3px 0', flexWrap: 'wrap' }}>
                  <span style={{ width: 92, fontWeight: 600, color: T.ink }}>{t.topic}</span>
                  {t.ranked.slice(0, 3).map((b, i) => (
                    <span key={b.name} style={{ color: b.isMe ? T.brandRed : T.muted, fontWeight: b.isMe ? 700 : 400 }}>
                      {i + 1}. {b.name} {b.vis}%
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </Screen>

      {/* 7 — TOPIC RANKINGS */}
      <Screen id="rankings" n={6} eyebrow="Topic Rankings" data={d} source={SOURCE}>
        <Card>
          {(() => {
            const nCols = Math.max(...d.topicRows.map(t => t.ranked.length), 1)
            return (
          <div className="report-tablewrap">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={thStyle}>Tópico</th>
              <th style={{ ...thStyle, width: 104 }}>Posição</th>
              {Array.from({ length: nCols }, (_, i) => <th key={i} style={{ ...thStyle, textAlign: 'center' }}>{i + 1}º</th>)}
            </tr></thead>
            <tbody>
              {d.topicRows.map(t => {
                const badge = t.myRank === 1
                  ? { label: 'Líder', color: T.green }
                  : t.myRank != null && t.myRank <= 3
                  ? { label: 'Competitiva', color: '#A87413' }
                  : { label: 'Atrás', color: T.red }
                return (
                  <tr key={t.topic}>
                    <td style={{ ...tdStyle, fontWeight: 600, color: T.ink }}>{t.topic}</td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, borderRadius: 999, padding: '3px 10px', background: `${badge.color}1c`, color: badge.color, whiteSpace: 'nowrap' }}>{badge.label}</span>
                    </td>
                    {Array.from({ length: nCols }, (_, i) => {
                      const b = t.ranked[i]
                      if (!b) return <td key={i} style={{ ...tdStyle, textAlign: 'center', color: T.muted }}>—</td>
                      return (
                        <td key={i} style={{ ...tdStyle, textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                            <span style={{ fontSize: 11.5, fontWeight: b.isMe ? 700 : 500, color: b.isMe ? T.brandRed : T.ink }}>{b.name}</span>
                            <span style={{ fontSize: 10.5, color: T.muted }}>{b.vis}%</span>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
            )
          })()}
          <div style={{ fontSize: 11, color: T.muted, marginTop: 10 }}>Métrica: % de respostas de IA do tópico que mencionam cada marca (uma marca conta no máximo 1× por resposta). Ranking completo de todas as marcas detetadas; a {d.brand} aparece a encarnado.</div>
        </Card>
      </Screen>

      {/* 8 — PERGUNTAS */}
      <Screen id="perguntas" n={7} eyebrow="Perguntas | Prompts" data={d} source={SOURCE}>
        <div className="report-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <Card>
            <div style={{ color: T.green, fontSize: 12, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 10 }}>Onde a {d.brand} ganha</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={{ ...thStyle, width: 86 }}>Tópico</th><th style={thStyle}>Pergunta</th><th style={{ ...thStyle, textAlign: 'center', width: 90 }}>Visibility Score</th><th style={{ ...thStyle, textAlign: 'center', width: 66 }}>Posição</th></tr></thead>
              <tbody>
                {d.bestPrompts.map(p => (
                  <tr key={p.text}>
                    <td style={{ ...tdStyle, color: T.purple, fontWeight: 600, fontSize: 11.5 }}>{p.topic || '—'}</td>
                    <td style={tdStyle}>{p.text}</td>
                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600, color: T.green }}>{p.score}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>{p.position != null ? fmtPos(p.position) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 10 }}>Visibility Score (0–100): média por resposta que pondera se a {d.brand} aparece e com que destaque; 100 = sempre presente em primeiro plano.</div>
          </Card>
          <Card>
            <div style={{ color: T.red, fontSize: 12, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 10 }}>Maior oportunidade</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={{ ...thStyle, width: 86 }}>Tópico</th><th style={thStyle}>Pergunta</th><th style={{ ...thStyle, textAlign: 'center', width: 62 }}>Score</th><th style={{ ...thStyle, textAlign: 'center', width: 62 }}>Fontes</th><th style={{ ...thStyle, width: 100 }}>Quem ganha</th></tr></thead>
              <tbody>
                {d.gapPrompts.map(p => (
                  <tr key={p.text}>
                    <td style={{ ...tdStyle, color: T.purple, fontWeight: 600, fontSize: 11.5 }}>{p.topic || '—'}</td>
                    <td style={tdStyle}>{p.text}</td>
                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600, color: T.red }}>0</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>{p.citations}</td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: T.ink }}>{p.winner || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 10 }}>Perguntas onde a {d.brand} nunca aparece (score 0). Fontes = nº de sites distintos citados pela IA nessas respostas — quanto mais fontes, mais espaço há para a marca entrar na conversa.</div>
          </Card>
        </div>
      </Screen>

      {/* 7 — MOTORES */}
      <Screen id="motores" n={8} eyebrow="Motores" data={d} source={SOURCE}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 18 }}>
          {d.llmCards.map(c => {
            const dom = llmDomain(c.model)
            return (
              <Card key={c.model} style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: T.muted, marginBottom: 8 }}>
                  {dom && <Favicon domain={dom} size={14} />}{c.label}
                </div>
                <div style={{ fontSize: 30, fontWeight: 300, color: c.avgScore >= 40 ? T.ink : T.red }}>{c.avgScore}</div>
                <div style={{ fontSize: 11, color: T.muted }}>{c.mentions} menções em {c.runs} respostas</div>
              </Card>
            )
          })}
        </div>
        <Card>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Score por motor × intenção de pesquisa</div>
          <div className="report-tablewrap">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={thStyle}>Intenção</th>
              {d.models.map(m => <th key={m} style={{ ...thStyle, textAlign: 'center' }}>{m === 'sonar' ? 'Perplexity' : m === 'google-aio' ? 'AI Overviews' : m === 'google-ai-mode' ? 'AI Mode' : m === 'gpt-4o-mini' ? 'ChatGPT' : m === 'gemini-2.5-flash' ? 'Gemini' : m}</th>)}
            </tr></thead>
            <tbody>
              {d.heatmap.filter(row => row.intent !== 'General').map(row => (
                <tr key={row.intent}>
                  <td style={{ ...tdStyle, fontWeight: 600, color: T.ink }}>{row.intent === 'Commercial' ? 'Comercial' : row.intent === 'Transactional' ? 'Transacional' : row.intent === 'Informational' ? 'Informativa' : 'Marca'}</td>
                  {d.models.map(m => {
                    const v = row.cells[m]
                    const bg = v == null ? '#F2F3F8' : v >= 70 ? `${T.green}26` : v >= 40 ? `${T.amber}26` : `${T.red}1f`
                    const col = v == null ? T.muted : v >= 70 ? T.green : v >= 40 ? '#A87413' : T.red
                    return <td key={m} style={{ ...tdStyle, textAlign: 'center', background: bg, color: col, fontWeight: 600 }}>{v == null ? '—' : v}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 14 }}>Métricas: cartões = score médio (0–100) das respostas de cada motor e nº de respostas que mencionam a marca · tabela = score médio por motor nas perguntas de cada intenção (verde ≥ 70, âmbar 40–69, vermelho &lt; 40).</div>
      </Screen>

      {/* 8 — INTENÇÕES */}
      <Screen id="intencoes" n={9} eyebrow="Intenções" data={d} source={SOURCE}>
        <Card>
          {[...d.intentRows].sort((a, b) => (a.isRef ? 1 : 0) - (b.isRef ? 1 : 0) || b.avgScore - a.avgScore).map(r => (
            <HBar
              key={r.intent}
              label={<>{r.intent === 'Commercial' ? 'Comercial' : r.intent === 'Transactional' ? 'Transacional' : r.intent === 'Informational' ? 'Informativa' : 'Marca (referência)'}</>}
              value={r.avgScore}
              max={maxIntent}
              isMe={!r.isRef}
              right={`${r.avgScore}`}
              sub={<>presença em {r.present} de {r.nPrompts} perguntas</>}
            />
          ))}
          <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>“Marca” é a pergunta direta sobre a {d.brand} — serve de referência, não de comparação.</div>
        </Card>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 14 }}>Métrica: score médio de visibilidade (0–100) das perguntas de cada intenção de pesquisa; presença = perguntas onde a marca aparece pelo menos uma vez.</div>
      </Screen>

      {/* 9 — NARRATIVA */}
      <Screen id="narrativa" n={10} eyebrow="Narrativa" data={d} source={`${SOURCE} · sentimento por menção`}>
        <div className="report-grid" style={{ gridTemplateColumns: '1.1fr 1fr' }}>
          <Card>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}>% de menções positivas por marca</div>
            {d.sentimentRows.map(r => (
              <HBar key={r.name} label={r.name} value={r.positive} max={100} isMe={r.isMe} right={`${r.positive}%`} />
            ))}
          </Card>
          <div style={{ display: 'grid', gap: 16 }}>
            <Card>
              <div style={{ color: T.green, fontSize: 11.5, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Atributos mais positivos</div>
              {d.topAttrs.map((a, i) => (
                <div key={a.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '5px 0', borderBottom: i < 2 ? `1px solid ${T.border}` : 'none' }}>
                  <span style={{ color: T.body }}>{a.label}</span><strong style={{ color: T.green }}>{a.positive}%</strong>
                </div>
              ))}
            </Card>
            <Card>
              <div style={{ color: T.amber, fontSize: 11.5, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Atributos a melhorar</div>
              {d.improveAttrs.map((a, i) => (
                <div key={a.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '5px 0', borderBottom: i < 2 ? `1px solid ${T.border}` : 'none' }}>
                  <span style={{ color: T.body }}>{a.label}</span><strong style={{ color: T.amber }}>{a.positive}%</strong>
                </div>
              ))}
            </Card>
            {flags.length > 0 && (
              <Card style={{ border: `1px solid ${T.red}55`, background: `${T.red}0d` }}>
                <div style={{ color: T.red, fontSize: 11.5, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Informação incorreta detetada</div>
                {flags.map((f, i) => <p key={i} style={{ fontSize: 12.5, color: T.body, margin: '4px 0' }}>{f.text}</p>)}
              </Card>
            )}
          </div>
        </div>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 14 }}>Métricas: sentimento classificado pela Peekaboo em cada menção (positivo/neutro/negativo); atributos extraídos dos resumos de menção — uma menção pode contar em mais de um atributo (mín. 10 menções por atributo).</div>
      </Screen>

      {/* 10 — CONCORRENTES E FONTES */}
      <Screen id="fontes" n={11} eyebrow="Concorrentes e fontes" data={d} source={SOURCE}>
        <div className="report-grid" style={{ gridTemplateColumns: '1.35fr 1fr' }}>
          <Card>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={thStyle}>Marca</th><th style={{ ...thStyle, textAlign: 'center', width: 62 }}>Score</th><th style={thStyle}>Fontes que a sustentam</th></tr></thead>
              <tbody>
                {d.compSources.map(c => (
                  <tr key={c.name} style={c.isMe ? { background: `${T.lime}22` } : undefined}>
                    <td style={{ ...tdStyle, fontWeight: c.isMe ? 700 : 400, color: c.isMe ? T.ink : T.body }}>{c.name}</td>
                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600 }}>{c.score}</td>
                    <td style={tdStyle}>
                      <span style={{ display: 'inline-flex', gap: 10, flexWrap: 'wrap' }}>
                        {c.topSources.map(sd => (
                          <span key={sd} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5 }}>
                            <Favicon domain={sd} size={12} />{sd}
                          </span>
                        ))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 10 }}>Score = visibilidade em IA (0–100), a mesma métrica do cartão \"AI Score vs Competitors\" do dashboard: % de respostas que mencionam a marca, calibrada ao score oficial da Peekaboo. Fontes = os 3 domínios mais citados nas respostas em que a marca aparece.</div>
          </Card>
          <div style={{ display: 'grid', gap: 16 }}>
            <Card>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Origem das citações da {d.brand}</div>
              <Donut {...d.donut} />
            </Card>
            <Card>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 6, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Risco de concentração</div>
              <div style={{ fontSize: 34, fontWeight: 300, color: d.concentration >= 60 ? T.red : d.concentration >= 40 ? '#A87413' : T.green }}>{d.concentration}%</div>
              <div style={{ fontSize: 12, color: T.muted }}>das citações vêm de apenas 5 fontes</div>
            </Card>
          </div>
        </div>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 14 }}>Métricas: donut = repartição das citações por origem (próprias = domínios da marca; concorrentes = domínios das marcas seguidas; terceiros = todo o resto) · risco de concentração = % das citações vindas das 5 fontes mais usadas.</div>
      </Screen>

      {/* 13 — DOMÍNIOS */}
      <Screen id="dominios" n={12} eyebrow="Domínios citados" data={d} source={SOURCE}>
        <div className="report-grid" style={{ gridTemplateColumns: '1fr 1.4fr' }}>
          <Card>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Top 5 domínios mais citados</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={thStyle}>Domínio</th><th style={{ ...thStyle, textAlign: 'center', width: 76 }}>Citações</th><th style={{ ...thStyle, width: 96 }}>Tipo</th></tr></thead>
              <tbody>
                {d.domainRows.map(r => (
                  <tr key={r.domain}>
                    <td style={tdStyle}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Favicon domain={r.domain} size={13} />{r.domain}</span></td>
                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600, color: T.ink }}>{fmtInt(r.mentions)}</td>
                    <td style={tdStyle}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '2px 9px', textTransform: 'uppercase',
                        background: r.kind === 'own' ? `${T.brandRed}1a` : r.kind === 'comp' ? `${T.amber}22` : `${T.cyan}1c`,
                        color: r.kind === 'own' ? T.brandRed : r.kind === 'comp' ? '#A87413' : T.cyan,
                      }}>{r.kind === 'own' ? 'Própria' : r.kind === 'comp' ? 'Concorrente' : 'Terceiros'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 10 }}>Citações = contagem oficial da Peekaboo: cada domínio conta 1× por resposta de IA, independentemente do nº de links citados. Tipo: própria (domínio da {d.brand}), concorrente ou terceiros.</div>
          </Card>
          <Card>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Citações de domínio por motor de IA</div>
            <div className="report-tablewrap">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={thStyle}>Motor</th>
                {d.domainMatrix.domains.map(dom => (
                  <th key={dom} style={{ ...thStyle, textAlign: 'center', fontSize: 10 }}>
                    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}><Favicon domain={dom} size={12} />{dom.replace(/^www\./, '').slice(0, 16)}</span>
                  </th>
                ))}
              </tr></thead>
              <tbody>
                {d.domainMatrix.rows.map(row => {
                  const maxC = Math.max(...Object.values(row.counts), 1)
                  return (
                    <tr key={row.model}>
                      <td style={{ ...tdStyle, fontWeight: 600, color: T.ink, whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          {llmDomain(row.model) && <Favicon domain={llmDomain(row.model)!} size={12} />}
                          {row.model === 'sonar' ? 'Perplexity' : row.model === 'google-aio' ? 'AI Overviews' : row.model === 'google-ai-mode' ? 'AI Mode' : row.model === 'gpt-4o-mini' ? 'ChatGPT' : row.model === 'gemini-2.5-flash' ? 'Gemini' : row.model}
                        </span>
                      </td>
                      {d.domainMatrix.domains.map(dom => {
                        const v = row.counts[dom] || 0
                        const alpha = v === 0 ? 0 : 0.12 + (v / maxC) * 0.5
                        return <td key={dom} style={{ ...tdStyle, textAlign: 'center', fontWeight: 600, background: `rgba(6,182,212,${alpha.toFixed(2)})`, color: v === 0 ? T.muted : T.ink }}>{v || '—'}</td>
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 10 }}>Nº de vezes que cada motor citou o domínio nas respostas analisadas · intensidade = peso na coluna do motor</div>
          </Card>
        </div>
      </Screen>
    </div>
  )
}
