import Image from 'next/image'
import { login } from './actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="min-h-screen flex">
      {/* Left — the reception wall */}
      <div className="hidden lg:flex w-1/2 bg-marquina relative flex-col items-center justify-center overflow-hidden">
        {/* faint marble veins */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            background:
              'radial-gradient(ellipse 60% 40% at 30% 20%, white, transparent), radial-gradient(ellipse 50% 30% at 75% 70%, white, transparent)',
          }}
        />
        <div
          className="absolute w-96 h-96 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgb(184 147 94 / 0.18), transparent 65%)',
            animation: 'glow-pulse 3s ease-in-out infinite',
          }}
        />
        <div style={{ animation: 'logo-bloom 1.2s cubic-bezier(0.16,1,0.3,1) both' }}>
          <Image src="/logo.png" alt="British ProCare" width={150} height={150} priority />
        </div>
        <h1
          className="font-display text-gold-light text-3xl mt-10 uppercase text-center"
          style={{ animation: 'letter-in 1s cubic-bezier(0.16,1,0.3,1) 0.4s both' }}
        >
          British ProCare
        </h1>
        <div className="gold-hairline w-52 mt-5" style={{ animation: 'hairline-grow 0.9s ease 0.8s both' }} />
        <p
          className="text-white/40 text-xs tracking-[0.3em] uppercase mt-5"
          style={{ animation: 'fade-up 0.8s ease 1.1s both' }}
        >
          Dental Clinics
        </p>
      </div>

      {/* Right — the form */}
      <div className="flex-1 flex items-center justify-center bg-marble px-6">
        <div className="w-full max-w-sm reveal-stagger">
          {/* mobile-only logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <Image src="/logo.png" alt="" width={80} height={80} />
          </div>

          <h2 className="font-display text-2xl text-ink-strong">Welcome back</h2>
          <p className="text-sm text-ink/50 mt-1 mb-8">Sign in to the clinic dashboard</p>

          {error && (
            <div className="bg-danger/10 text-danger text-sm px-4 py-3 rounded-control mb-5">
              {error}
            </div>
          )}

          <form className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-sm text-ink/70">Email</label>
              <input
                name="email"
                type="email"
                required
                className="w-full rounded-control border border-ink/15 bg-white px-3.5 py-2.5 text-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-teal"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-ink/70">Password</label>
              <input
                name="password"
                type="password"
                required
                className="w-full rounded-control border border-ink/15 bg-white px-3.5 py-2.5 text-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-teal"
              />
            </div>

            <button
              formAction={login}
              className="w-full bg-marquina hover:bg-marquina-soft text-gold-light font-display tracking-wider uppercase text-sm rounded-control py-3 transition-colors"
            >
              Enter Clinic
            </button>
          </form>

          <div className="gold-hairline mt-10" />
          <p className="text-center text-ink/30 text-xs mt-4 tracking-widest uppercase">
            Dr. Heba Al-Batanony
          </p>
        </div>
      </div>
    </div>
  )
}