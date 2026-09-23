import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role client for server code that acts without a signed-in user —
 * the public registration page, the hardware bridge. It bypasses RLS, so it
 * must only ever run on the server and only after the caller's input has been
 * validated. Returns null when the key is not configured, so callers can show
 * a clear error instead of crashing.
 */
export function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY

  if (!url || !key) return null

  return createClient(url, key, { auth: { persistSession: false } })
}
