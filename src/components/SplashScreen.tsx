'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

export default function SplashScreen() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!sessionStorage.getItem('procare_splash_seen')) {
      setShow(true)
      sessionStorage.setItem('procare_splash_seen', '1')
      const t = setTimeout(() => setShow(false), 3200)
      return () => clearTimeout(t)
    }
  }, [])

  if (!show) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-marquina"
      style={{ animation: 'splash-exit 0.6s ease 2.6s both' }}
    >
      {/* breathing gold glow behind the logo */}
      <div
        className="absolute w-72 h-72 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgb(184 147 94 / 0.25), transparent 65%)',
          animation: 'glow-pulse 2.4s ease-in-out infinite',
        }}
      />

      <div style={{ animation: 'logo-bloom 1.1s cubic-bezier(0.16, 1, 0.3, 1) both' }}>
        <Image src="/logo.png" alt="" width={130} height={130} priority />
      </div>

      <h1
        className="font-display text-gold-light text-2xl mt-8 uppercase"
        style={{ animation: 'letter-in 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.55s both' }}
      >
        British ProCare
      </h1>

      <div
        className="gold-hairline w-48 mt-4"
        style={{ animation: 'hairline-grow 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.9s both' }}
      />

      <p
        className="text-white/40 text-xs tracking-[0.3em] uppercase mt-4 font-sans"
        style={{ animation: 'fade-up 0.7s ease 1.2s both' }}
      >
        Dental Clinics · Dr. Heba Al-Batanony
      </p>
    </div>
  )
}