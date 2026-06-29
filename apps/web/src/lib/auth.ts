import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// Authenticate via cookie session OR Bearer token (for Chrome extension)
export async function getAuthUser(request: Request) {
  // Try Bearer token first (Chrome extension / API clients)
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const admin = createAdminClient()
    const { data: { user }, error } = await admin.auth.getUser(token)
    if (!error && user) return user
  }

  // Fallback: cookie-based session (web app)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user ?? null
}
