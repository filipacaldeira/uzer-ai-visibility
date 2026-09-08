// Server-side proxy to the Peekaboo API. The API key lives ONLY in the
// Netlify environment (PEEKABOO_API_KEY) — never in the public JS bundle.
// Phase 2 (client logins) will add session validation + per-user brand
// authorization here before forwarding.
export default async (request: Request) => {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ success: false, error: { message: 'Method not allowed' } }), {
      status: 405, headers: { 'content-type': 'application/json' },
    })
  }
  const url = new URL(request.url)
  const upstream = 'https://www.aipeekaboo.com' + url.pathname.replace(/^\/api-proxy/, '') + url.search
  // deno-lint-ignore no-explicit-any
  const key = (globalThis as any).Deno?.env.get('PEEKABOO_API_KEY') || ''
  const res = await fetch(upstream, { headers: { 'X-API-Key': key } })
  const headers = new Headers({ 'content-type': res.headers.get('content-type') || 'application/json' })
  const retryAfter = res.headers.get('retry-after')
  if (retryAfter) headers.set('retry-after', retryAfter) // the client's 429 backoff reads this
  return new Response(res.body, { status: res.status, headers })
}

export const config = { path: '/api-proxy/*' }
