import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SplashScreen from '@/components/SplashScreen'
import AppShell from '@/components/AppShell'
import { signOut } from './actions'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch clinic configuration for dynamic navigation
  const { data: config } = await supabase
    .from('clinic_configuration')
    .select('features_enabled, google_sheets_enabled')
    .single()

  return (
    <>
      <SplashScreen />
      <AppShell userEmail={user.email || ''} signOutAction={signOut} config={config}>
        {children}
      </AppShell>
    </>
  )
}
