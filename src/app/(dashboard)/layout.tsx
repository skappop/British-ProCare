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

  return (
    <>
      <SplashScreen />
      <AppShell userEmail={user.email || ''} signOutAction={signOut}>
        {children}
      </AppShell>
    </>
  )
}
