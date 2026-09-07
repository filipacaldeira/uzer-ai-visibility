import { llmLabel, llmColor, llmDomain } from '../../utils/format'
import { Favicon } from './Favicon'

const KNOWN_LLMS = [
  { id: 'gpt-4o-mini',       label: 'ChatGPT' },
  { id: 'gemini-2.5-flash',  label: 'Gemini' },
  { id: 'google-ai-mode',    label: 'Google AI Mode' },
  { id: 'google-aio',        label: 'Google AIO' },
  { id: 'perplexity',        label: 'Perplexity' },
  { id: 'claude-3-5-sonnet', label: 'Claude' },
]

interface LLMPresenceGridProps {
  modelScores: Record<string, number>
}

export function LLMPresenceGrid({ modelScores }: LLMPresenceGridProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {KNOWN_LLMS.map(({ id, label }) => {
        const score = modelScores[id] ?? null
        const present = score !== null && score > 0
        const color = llmColor(id)
        const domain = llmDomain(id)
        return (
          <div
            key={id}
            className={`flex items-center gap-2.5 p-2.5 rounded-lg border transition-colors ${
              present
                ? 'border-brand-primary/30 bg-brand-primary/5'
                : 'border-brand-border bg-brand-elevated/30'
            }`}
          >
            {domain ? (
              <Favicon domain={domain} size={14} className={present ? '' : 'opacity-40'} />
            ) : (
              <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            )}
            <span className={`text-xs font-medium flex-1 ${present ? 'text-brand-text' : 'text-brand-muted'}`}>
              {label}
            </span>
            {score !== null ? (
              <span className="text-xs font-semibold tabular-nums" style={{ color: present ? color : undefined }}>
                {score}%
              </span>
            ) : (
              <span className="text-xs text-brand-dim">—</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export { llmLabel }
