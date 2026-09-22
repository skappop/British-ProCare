import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RapidScanClient from './RapidScanClient'

export default async function RapidScanPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch all containers for reference
  const { data: containers } = await supabase
    .from('containers')
    .select('id, name')
    .order('name')

  return <RapidScanClient userEmail={user.email || ''} containers={containers || []} />
}
