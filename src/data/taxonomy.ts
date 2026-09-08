import tax from './myforce_prompt_taxonomy.json'

// User-approved prompt taxonomy (topics + search intents), versioned in the
// repo so every surface (Topics | Prompts, By LLM, Trends, /report) reads the
// same classification. localStorage keeps working as a per-browser override
// for topic edits made in the UI.

export const TAXONOMY_TOPICS: string[] = tax.topics
export const TAXONOMY_INTENTS: string[] = tax.intents

export const taxonomyTopicAssignments: Record<string, string> =
  tax.promptTopicAssignments as Record<string, string>

const intentOverrides: Record<string, string> =
  tax.promptIntentOverrides as Record<string, string>

/**
 * Search intent for a prompt. The Peekaboo `category` field is unreliable
 * (most prompts land in "General"), so the user-curated override wins.
 */
export function getPromptIntent(p: { promptId?: string; category?: string | null }): string {
  return (p.promptId && intentOverrides[p.promptId]) || p.category || 'General'
}

/**
 * The taxonomy the dashboard actually displays: repo baseline merged with the
 * edits made in Topics | Prompts (stored in localStorage). The report MUST use
 * this — never the raw baseline — so both always show the same topics.
 */
export function getEffectiveTaxonomy(): { topics: string[]; assignments: Record<string, string> } {
  let topics = TAXONOMY_TOPICS
  let assignments: Record<string, string> = { ...taxonomyTopicAssignments }
  try {
    const ls = JSON.parse(localStorage.getItem('prompt-topics-list') || 'null')
    if (Array.isArray(ls) && ls.length > 0) topics = ls
    assignments = { ...assignments, ...JSON.parse(localStorage.getItem('prompt-topic-assignments') || '{}') }
  } catch { /* corrupt localStorage — fall back to the baseline */ }
  return { topics, assignments }
}
