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
