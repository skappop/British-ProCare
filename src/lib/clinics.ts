import { createClient } from '@/lib/supabase/server'

export type Clinic = {
  id: string
  name: string
  short_name: string | null
}

/**
 * Active clinics, in display order. Returns [] when migration 13 has not been
 * run yet, so every caller degrades to single-clinic behaviour instead of
 * erroring.
 */
export async function getClinics(): Promise<Clinic[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('clinics')
    .select('id, name, short_name')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  return data ?? []
}
