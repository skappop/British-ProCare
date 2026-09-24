'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { LogOut, Menu, X } from 'lucide-react'
import SidebarNav from '@/components/SidebarNav'

interface NavConfig {
  features_enabled?: {
    appointments?: boolean
    recall?: boolean
    inventory?: boolean
    lab_cases?: boolean
    staff?: boolean
    reports?: boolean
  }
  google_sheets_enabled?: boolean
}

export default function AppShell({
  userEmail,
  signOutAction,
  config,
  role,
  children,
}: {
  userEmail: string
  signOutAction: () => Promise<void>
  config?: NavConfig | null
  role?: 'owner' | 'dentist' | 'assistant' | null
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Close the drawer whenever the route changes (i.e. a nav link was tapped).
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Prevent body scroll behind the open drawer on mobile.
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [open])

  const Brand = (
    <div className="flex items-center gap-3">
      <Image src="/logo.png" alt="" width={36} height={36} />
      <div>
        <h1 className="font-display text-sm text-gold-light leading-tight uppercase tracking-wide">British ProCare</h1>
        <p className="text-[10px] text-white/35 tracking-[0.25em] uppercase mt-0.5">Dental Clinics</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen">
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 bg-marquina text-white px-4 h-14 shadow-sm">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="p-2 -ml-2 text-white/80 hover:text-gold-light"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="" width={26} height={26} />
          <span className="font-display text-sm text-gold-light uppercase tracking-wide">British ProCare</span>
        </div>
      </header>

      {/* Backdrop (mobile only) — always mounted so it fades in sync with the panel */}
      <div
        className={`md:hidden fixed inset-0 bg-black/45 z-40 transition-opacity duration-[400ms] ease-out-soft ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setOpen(false)}
        aria-hidden
      />

      {/* Sidebar — static on desktop, slide-in drawer on mobile */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 max-w-[82vw] bg-marquina text-white flex flex-col transition-transform duration-[400ms] ease-out-soft md:transition-none md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-5">
          {Brand}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="md:hidden p-1.5 -mr-1 text-white/50 hover:text-gold-light"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <div className="gold-hairline mx-6 mb-4" />

        <div className="flex-1 overflow-y-auto">
          <SidebarNav config={config} role={role} />
        </div>

        <div className="px-6 pb-6">
          <div className="gold-hairline mb-4" />
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/40 truncate">{userEmail}</span>
            <form action={signOutAction}>
              <button
                type="submit"
                className="text-white/40 hover:text-gold-light transition-colors p-1.5"
                title="Sign out"
              >
                <LogOut size={15} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="md:ml-64 p-4 sm:p-6 lg:p-10">{children}</main>
    </div>
  )
}
