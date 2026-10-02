import Image from 'next/image'

export default function PatientLoading() {
  return (
    <div className="space-y-6">
      <div className="flex min-h-[180px] items-center justify-center rounded-card bg-marquina">
        <div className="logo-loading flex flex-col items-center gap-3 text-white/60"><Image src="/logo.png" alt="" width={48} height={48} priority /><span className="font-mono text-[10px] uppercase tracking-[0.2em]">Opening patient chart</span></div>
      </div>
      <div className="skeleton-pulse space-y-4 rounded-card bg-white p-6 shadow-soft"><div className="h-5 w-48 rounded bg-ink/10" /><div className="h-24 rounded bg-ink/5" /><div className="h-12 rounded bg-ink/5" /></div>
    </div>
  )
}
