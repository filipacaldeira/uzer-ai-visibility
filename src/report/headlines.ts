import type { ReportData } from './useReportData'

// One pure function per screen. Rules (brief): always a conclusion with a
// number, brand as subject, competitors by name, no vague quantifiers; if the
// data is good the "mas" comes after, if bad the "mas" brings the good news.
// Fallback: when data is missing, return the template without brackets filled.

const INTENT_PT: Record<string, string> = {
  Commercial: 'comerciais',
  Transactional: 'transacionais',
  Informational: 'informativas',
  General: 'de marca',
}

function listPt(items: string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`
}

export const headlines: Record<string, (d: ReportData) => string> = {
  capa: d => `Quando os consumidores perguntam à IA, a ${d.brand} aparece?`,

  sumario: d => {
    const weak = [...d.topicRows].sort((a, b) => a.avgScore - b.avgScore).slice(0, 3).map(t => t.topic.toLowerCase())
    return weak.length >= 2
      ? `A ${d.brand} já está na conversa — mas ainda não entra nas decisões de ${listPt(weak)}`
      : `A ${d.brand} já está na conversa — mas ainda não entra em todas as decisões`
  },

  score: d => {
    const pos = d.avgPosition != null ? ` — mas quando aparece está em ${Math.round(d.avgPosition)}º lugar` : ''
    return `A ${d.brand} aparece em apenas ${d.score}% das respostas${pos}`
  },

  sov: d => {
    const share = d.marketShare
    let tail: string
    if (d.leaderGap > 0) tail = `lidera com ${d.leaderGap} pts de avanço sobre a ${d.leaderName}`
    else if (d.leaderGap === 0) tail = `empatada na liderança com a ${d.leaderName}`
    else tail = `a ${Math.abs(d.leaderGap)} pts da líder ${d.leaderName}`
    return `A ${d.brand} conquista ${share}% da conversa — ${tail}`
  },

  motores: d => {
    const best = d.llmCards[0]
    const worst = d.llmCards[d.llmCards.length - 1]
    if (!best || !worst || best.model === worst.model) return `Nem todos os motores contam a mesma história sobre a ${d.brand}`
    const gapIntent = d.intentGap ? ` nas perguntas ${INTENT_PT[d.intentGap.intent] || d.intentGap.intent.toLowerCase()}` : ''
    return `No ${best.label} a ${d.brand} é referência; no ${worst.label} desaparece${gapIntent}`
  },

  servicos: d => {
    const sorted = [...d.topicRows].sort((a, b) => b.avgScore - a.avgScore)
    const strong = sorted.slice(0, 2).map(t => t.topic.toLowerCase())
    const weak = sorted.slice(-3).filter(t => !strong.includes(t.topic.toLowerCase())).map(t => t.topic.toLowerCase())
    if (strong.length < 2 || weak.length < 2) return `Uns serviços trazem a ${d.brand} para a resposta; outros deixam espaço à concorrência`
    return `${listPt(strong.map(s => s.charAt(0).toUpperCase() + s.slice(1)))} trazem a ${d.brand} para a resposta; ${listPt(weak)} deixam espaço à concorrência`
  },

  intencoes: d => {
    const rows = d.intentRows.filter(r => !r.isRef).sort((a, b) => b.avgScore - a.avgScore)
    if (rows.length >= 2) {
      const best = rows[0], worst = rows[rows.length - 1]
      if (best.intent === 'Transactional' && worst.intent === 'Informational')
        return `A ${d.brand} entra quando o cliente já decidiu ir à oficina — e está ausente quando ainda está a perceber o problema`
      return `A ${d.brand} ganha nas perguntas ${INTENT_PT[best.intent] || best.intent} — perde nas ${INTENT_PT[worst.intent] || worst.intent}`
    }
    return `A ${d.brand} não responde da mesma forma a todas as intenções de pesquisa`
  },

  evolucao: d => {
    const pts = d.timeline
    if (pts.length >= 2) {
      const first = pts[0].values[d.brand] ?? 0
      const last = pts[pts.length - 1].values[d.brand] ?? 0
      if (Math.abs(last - first) <= 3) return `A visibilidade da ${d.brand} mantém-se estável em torno de ${d.score}% — a corrida decide-se nos tópicos, não no tempo`
      return last > first
        ? `A visibilidade da ${d.brand} subiu de ${first}% para ${last}% ao longo do período`
        : `A visibilidade da ${d.brand} desceu de ${first}% para ${last}% ao longo do período`
    }
    return `A visibilidade da ${d.brand} ao longo do período`
  },

  rankings: d => {
    const lead = d.topicRows.filter(t => t.myRank === 1)
    const lost = d.topicRows.filter(t => t.myRank != null && t.myRank > 1)
    if (d.topicRows.length === 0) return `Quem manda em cada tópico da conversa`
    const losers = [...new Set(lost.map(t => t.top5[0]?.name).filter(Boolean))]
    const tail = lost.length > 0 && losers.length > 0
      ? ` — ${listPt(losers)} ${losers.length === 1 ? 'manda' : 'mandam'} em ${listPt(lost.map(t => t.topic.toLowerCase()))}`
      : ''
    return `A ${d.brand} lidera em ${lead.length} dos ${d.topicRows.length} tópicos${tail}`
  },

  perguntas: d => `É nestas perguntas que a ${d.brand} ganha — e nestas que desaparece`,

  narrativa: d => `Ser mencionada não basta: esta é a história que a IA conta sobre a ${d.brand}`,

  fontes: d => {
    const comps = d.compSources.filter(c => !c.isMe).slice(0, 2).map(c => c.name)
    if (comps.length >= 2 && d.donut.owned > d.donut.earned)
      return `A ${comps[0]} e a ${comps[1]} ganham por serem citadas por terceiros; a ${d.brand} depende de si própria`
    if (comps.length >= 2)
      return `A ${comps[0]} e a ${comps[1]} disputam as mesmas fontes que sustentam a ${d.brand}`
    return `As fontes citadas pela IA decidem quem entra na resposta`
  },

  dominios: d => {
    const top = d.domainRows[0]
    if (!top) return `Os domínios mais citados pela IA decidem quem entra na resposta`
    return `${top.domain} é a fonte que mais alimenta as respostas — ${top.mentions} citações no período`
  },
}

export function autoHeadline(id: string, d: ReportData): string {
  const fn = headlines[id]
  try { return fn ? fn(d) : '' } catch { return '' }
}
