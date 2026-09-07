import { useCallback, useEffect, useRef, useState } from 'react'
import { useReportData, type ReportData } from '../report/useReportData'
import { autoHeadline } from '../report/headlines'
import { llmDomain } from '../utils/format'
import { Favicon } from '../components/ui/Favicon'
import factsFlags from '../data/myforce_facts_flags.json'

// UZER Ethereal Flux tokens (design skill)
const T = {
  navy: '#0B1326', ink: '#10182E', body: '#3C3C3C', muted: '#5A6378',
  border: '#E3E5EE', purple: '#8B5CF6', cyan: '#06B6D4', lime: '#DFFF11',
  green: '#30A46C', amber: '#F5A623', red: '#E5484D',
  bar: '#0B1326', barComp: '#9DA5BC', paper: '#F5F6FA',
}

const OVERRIDES_KEY = 'report-headline-overrides'
const SCREEN_IDS = ['capa', 'sumario', 'score', 'sov', 'motores', 'servicos', 'intencoes', 'perguntas', 'narrativa', 'fontes']

function readOverrides(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(OVERRIDES_KEY) || '{}') } catch { return {} }
}

/* ---------- shared building blocks ---------- */

function Eyebrow({ children, dark = false }: { children: string; dark?: boolean }) {
  return (
    <div style={{
      color: dark ? T.lime : T.purple, fontSize: 13, letterSpacing: '0.35em',
      textTransform: 'uppercase', fontWeight: 500, marginBottom: 14, fontFamily: 'Inter, sans-serif',
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
      <span>{n} / 10</span>
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

/* ---------- the report ---------- */

const SOURCE = 'Fonte: Peekaboo · análise de respostas de IA'

export default function Report() {
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
      if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); goTo(Math.min(active + 1, 9)) }
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
      <style>{`
        .report-screen { min-height: 92vh; position: relative; display: flex; flex-direction: column; padding: 56px 64px 30px; box-sizing: border-box; }
        .report-screen h2[contenteditable]:hover { box-shadow: 0 2px 0 ${T.purple}55; }
        .report-grid { display: grid; gap: 16px; }
        @media (max-width: 1120px) {
          .report-grid { grid-template-columns: 1fr !important; }
          .report-screen { padding: 40px 28px 24px; }
        }
        .report-tablewrap { overflow-x: auto; }
        @media print {
          @page { size: A4 landscape; margin: 0; }
          .report-noprint, .report-rail, .report-toolbar { display: none !important; }
          .report-screen { min-height: 100vh; height: 100vh; page-break-after: always; overflow: hidden; }
          body { background: #fff; }
        }
      `}</style>

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
            <span>{d.totalRuns.toLocaleString('pt-PT')} respostas de IA analisadas</span>
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
      </Screen>

      {/* 3 — SCORE */}
      <Screen id="score" n={3} eyebrow="Score" data={d} source={`${SOURCE} · ${d.totalRuns.toLocaleString('pt-PT')} respostas`}>
        <Card style={{ display: 'flex', alignItems: 'center', gap: 48, padding: '34px 44px' }}>
          <div>
            <div style={{ fontSize: 92, fontWeight: 100, color: T.ink, lineHeight: 1 }}>{d.score}<span style={{ fontSize: 30, color: T.muted }}>/100</span></div>
            <div style={{ fontSize: 12.5, color: T.muted, marginTop: 6 }}>score de visibilidade em IA</div>
          </div>
          <Gauge score={d.score} />
          <div style={{ display: 'grid', gap: 14 }}>
            {d.avgPosition != null && (
              <div><div style={{ fontSize: 26, fontWeight: 300, color: T.ink }}>{d.avgPosition}.º</div><div style={{ fontSize: 12, color: T.muted }}>posição média quando citada</div></div>
            )}
            <div><div style={{ fontSize: 26, fontWeight: 300, color: T.ink }}>{d.totalRuns.toLocaleString('pt-PT')}</div><div style={{ fontSize: 12, color: T.muted }}>respostas analisadas</div></div>
            <div style={{ fontSize: 11.5, color: T.muted }}>Tendência do período: {d.trend === 'up' ? 'a subir' : d.trend === 'down' ? 'a descer' : 'estável'}</div>
          </div>
        </Card>
      </Screen>

      {/* 4 — SHARE OF VOICE */}
      <Screen id="sov" n={4} eyebrow="Share of voice" data={d} source={SOURCE}>
        <Card>
          {d.sovRows.map(r => (
            <HBar key={r.name} label={r.name} value={r.score} max={maxSov} isMe={r.isMe} right={`${r.score}/100`} />
          ))}
          <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>Média dos concorrentes: <strong style={{ color: T.ink }}>{d.avgCompScore}</strong> · score de visibilidade em IA (0–100)</div>
        </Card>
      </Screen>

      {/* 5 — MOTORES */}
      <Screen id="motores" n={5} eyebrow="Motores" data={d} source={SOURCE}>
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
              {d.heatmap.map(row => (
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
      </Screen>

      {/* 6 — SERVIÇOS */}
      <Screen id="servicos" n={6} eyebrow="Serviços" data={d} source={SOURCE}>
        <Card>
          {[...d.topicRows].sort((a, b) => b.avgScore - a.avgScore).map(t => (
            <HBar
              key={t.topic}
              label={t.topic}
              value={t.avgScore}
              max={maxTopic}
              isMe={t.avgScore >= 40}
              right={`${t.avgScore}`}
              sub={<>presença em {t.present} de {t.nPrompts} perguntas{t.topComp ? <> · concorrente mais presente: <strong style={{ color: T.ink }}>{t.topComp}</strong></> : null}</>}
            />
          ))}
          <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>Score médio da {d.brand} por tópico (0–100)</div>
        </Card>
      </Screen>

      {/* 7 — INTENÇÕES */}
      <Screen id="intencoes" n={7} eyebrow="Intenções" data={d} source={SOURCE}>
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
      </Screen>

      {/* 8 — PERGUNTAS */}
      <Screen id="perguntas" n={8} eyebrow="Perguntas" data={d} source={SOURCE}>
        <div className="report-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <Card>
            <div style={{ color: T.green, fontSize: 11.5, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 10 }}>Onde a {d.brand} ganha</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={thStyle}>Pergunta</th><th style={{ ...thStyle, textAlign: 'center', width: 62 }}>Score</th><th style={{ ...thStyle, textAlign: 'center', width: 70 }}>Posição</th></tr></thead>
              <tbody>
                {d.bestPrompts.map(p => (
                  <tr key={p.text}><td style={tdStyle}>{p.text}</td><td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600, color: T.green }}>{p.score}</td><td style={{ ...tdStyle, textAlign: 'center' }}>{p.position != null ? `${p.position}.º` : '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card>
            <div style={{ color: T.red, fontSize: 11.5, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 10 }}>Onde desaparece (maior oportunidade)</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={thStyle}>Pergunta</th><th style={{ ...thStyle, textAlign: 'center', width: 70 }}>Fontes</th><th style={{ ...thStyle, width: 110 }}>Quem ganha</th></tr></thead>
              <tbody>
                {d.gapPrompts.map(p => (
                  <tr key={p.text}><td style={tdStyle}>{p.text}</td><td style={{ ...tdStyle, textAlign: 'center' }}>{p.citations}</td><td style={{ ...tdStyle, fontWeight: 600, color: T.ink }}>{p.winner || '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </Screen>

      {/* 9 — NARRATIVA */}
      <Screen id="narrativa" n={9} eyebrow="Narrativa" data={d} source={`${SOURCE} · sentimento por menção`}>
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
      </Screen>

      {/* 10 — CONCORRENTES E FONTES */}
      <Screen id="fontes" n={10} eyebrow="Concorrentes e fontes" data={d} source={SOURCE}>
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
      </Screen>
    </div>
  )
}
