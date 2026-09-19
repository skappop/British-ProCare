'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'

const HOLD_MS = 700
const EXIT_MS = 220

export default function SplashScreen() {
  const [phase, setPhase] = useState<'hidden' | 'visible' | 'exiting'>('hidden')

  const dismiss = useCallback(() => {
    setPhase((p) => (p === 'visible' ? 'exiting' : p))
  }, [])

  useEffect(() => {
    if (sessionStorage.getItem('procare_splash_seen')) return
    sessionStorage.setItem('procare_splash_seen', '1')
    setPhase('visible')
    const t = setTimeout(dismiss, HOLD_MS)
    return () => clearTimeout(t)
  }, [dismiss])

  // Any pointer or key press skips straight to the exit transition —
  // the splash should never hold a clinician at a chairside tablet.
  useEffect(() => {
    if (phase !== 'visible') return
    window.addEventListener('pointerdown', dismiss)
    window.addEventListener('keydown', dismiss)
    return () => {
      window.removeEventListener('pointerdown', dismiss)
      window.removeEventListener('keydown', dismiss)
    }
  }, [phase, dismiss])

  if (phase === 'hidden') return null

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-marquina"
      style={{
        opacity: phase === 'exiting' ? 0 : 1,
        pointerEvents: phase === 'exiting' ? 'none' : 'auto',
        transition: `opacity ${EXIT_MS}ms var(--ease-out)`,
      }}
      onTransitionEnd={() => phase === 'exiting' && setPhase('hidden')}
    >
      {/* breathing gold glow behind the logo */}
      <div
        className="absolute w-72 h-72 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgb(184 147 94 / 0.25), transparent 65%)',
          animation: 'glow-pulse 2.4s ease-in-out infinite',
        }}
      />

      <div style={{ animation: 'logo-bloom 0.45s var(--ease-out) both' }}>
        <Image src="/logo.png" alt="" width={130} height={130} priority />
      </div>

      <h1
        className="font-display text-gold-light text-2xl mt-8 uppercase"
        style={{ animation: 'letter-in 0.4s var(--ease-out) 0.15s both' }}
      >
        British ProCare
      </h1>

      <div
        className="gold-hairline w-48 mt-4"
        style={{ animation: 'hairline-grow 0.35s var(--ease-out) 0.3s both' }}
      />

      <p
        className="text-white/40 text-xs tracking-[0.3em] uppercase mt-4 font-sans"
        style={{ animation: 'letter-in 0.35s var(--ease-out) 0.4s both' }}
      >
        Dental Clinics · Dr. Heba Al-Batanony
      </p>
    </div>
  )
}
