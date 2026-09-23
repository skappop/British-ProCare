import Image from 'next/image'
import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import RegisterForm from './RegisterForm'

// Rendered per request, not at build time, so the clinic list reflects the
// clinics table today rather than on the day this was deployed.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Register — British ProCare',
  description: 'Fill in your details before your visit to British ProCare Dental Clinics.',
}

// Public: patients open this from a link or QR code, without an account.
export default async function RegisterPage() {
  const admin = createAdminClient()
  const { data: clinics } = admin
    ? await admin
        .from('clinics')
        .select('id, name')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
    : { data: null }

  return (
    <div className="min-h-screen bg-marble">
      <header className="bg-marquina text-white">
        <div className="max-w-xl mx-auto px-5 py-6 flex items-center gap-4">
          <Image src="/logo.png" alt="" width={48} height={48} />
          <div>
            <p className="font-display text-gold-light text-lg uppercase tracking-wide">British ProCare</p>
            <p className="text-white/50 text-xs tracking-[0.2em] uppercase">Dental Clinics</p>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-5 py-8">
        <RegisterForm clinics={clinics ?? []} />
      </main>
    </div>
  )
}
