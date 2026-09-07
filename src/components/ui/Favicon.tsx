// LLM platform favicons get a white background for visibility in dark mode
const NEEDS_WHITE_BG = new Set(['chatgpt.com', 'gemini.google.com', 'google.com', 'claude.ai', 'perplexity.ai'])

interface FaviconProps {
  domain: string
  size?: number
  className?: string
}

export function Favicon({ domain, size = 16, className = '' }: FaviconProps) {
  const whiteBg = NEEDS_WHITE_BG.has(domain)
  const img = (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=${size * 2}`}
      alt={domain}
      width={size}
      height={size}
      className="block"
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
    />
  )
  if (whiteBg) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-sm flex-shrink-0 bg-white ${className}`}
        style={{ width: size + 4, height: size + 4, padding: 2 }}
      >
        {img}
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center justify-center flex-shrink-0 ${className}`} style={{ width: size, height: size }}>
      {img}
    </span>
  )
}
