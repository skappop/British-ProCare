import Link from 'next/link'
import { ArrowLeft, Printer } from 'lucide-react'
import { getCabinet, getContainers } from '../data'
import SetupClient from './SetupClient'

export const dynamic = 'force-dynamic'

/** What each container holds when full, and each cabinet item's minimum and supplier. */
export default async function StockSetupPage() {
  const [{ ready, containers }, cabinet] = await Promise.all([getContainers(), getCabinet()])
  if (!ready || !cabinet.ready) {
    return (
      <p className="mx-auto max-w-2xl rounded-card bg-white p-6 text-sm text-ink/60 shadow-soft">
        Stock check is not set up yet — run <span className="font-mono">migrations/18_stock_routines.sql</span> in Supabase.
      </p>
    )
  }
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/stock" className="-ml-1 rounded-control p-2 text-ink/50 hover:bg-marble" aria-label="Back to Stock check">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="font-display text-2xl text-ink-strong">Stock set-up</h1>
        </div>
        {containers.length > 0 && (
          <Link href="/stock/setup/labels" className="inline-flex items-center gap-1.5 rounded-control border border-ink/15 px-3 py-2 text-sm text-ink/70 hover:bg-white">
            <Printer size={15} /> Print container stickers
          </Link>
        )}
      </div>
      <SetupClient containers={containers} items={cabinet.items} suppliers={cabinet.suppliers} />
    </div>
  )
}
