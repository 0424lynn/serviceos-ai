import { createClient } from '@supabase/supabase-js'

// Service role client — bypasses RLS, only use in server-side API routes
// Never import this in client components or expose to the browser
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase service role credentials')
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
