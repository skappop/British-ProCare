import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsClient from './SettingsClient'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch current configuration
  const { data: config } = await supabase
    .from('clinic_configuration')
    .select('*')
    .single()

  return <SettingsClient config={config} userEmail={user.email || ''} />
}
