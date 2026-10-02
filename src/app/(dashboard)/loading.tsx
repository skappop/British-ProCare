import Image from 'next/image'

export default function DashboardLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="logo-loading rounded-full bg-white p-3 shadow-soft">
          <Image src="/logo.png" alt="" width={56} height={56} priority />
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold-deep">British ProCare</p>
        <div className="h-1 w-28 overflow-hidden rounded-full bg-ink/10"><div className="loading-bar h-full w-1/2 rounded-full bg-teal" /></div>
      </div>
    </div>
  )
}
