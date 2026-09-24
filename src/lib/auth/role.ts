import { createClient } from '@/lib/supabase/server'

export type StaffRole = 'owner' | 'dentist' | 'assistant'

export async function getCurrentUserRole(): Promise<StaffRole | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return (profile?.role as StaffRole) || null
}

export async function isOwner(): Promise<boolean> {
  const role = await getCurrentUserRole()
  return role === 'owner'
}

/**
 * Who deals with money: the owner and the front desk (assistants). Dentists
 * work chairside, often with the patient looking at the screen, so fees,
 * balances and payments are kept out of their view entirely.
 */
export async function canHandleMoney(): Promise<boolean> {
  const role = await getCurrentUserRole()
  return role === 'owner' || role === 'assistant'
}
